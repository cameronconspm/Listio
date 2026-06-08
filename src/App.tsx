import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Alert, Linking, AppState } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { appFontAssets } from './design/fonts';
import type { LinkingOptions } from '@react-navigation/native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { ThemeProvider, useTheme } from './design/ThemeContext';
import { AuthNavigator } from './navigation/AuthNavigator';
import type { RootStackParamList } from './navigation/types';
import { buildRootLinkingOptions } from './navigation/linking';
import { isSupabaseSyncRequiredButMisconfigured } from './services/supabaseClient';
import { consumeSupabaseAuthFromUrl } from './services/authDeepLink';
import {
  ensurePurchasesConfigured,
  fetchPremiumEntitlementActive,
  installRevenueCatCustomerInfoListener,
  shouldEnforceIosSubscriptionGate,
  subscribePremiumStatusChanges,
  syncPurchasesIdentity,
} from './services/purchasesService';
import { isOnboardingCompleted, clearOnboardingCompletion } from './services/onboardingService';
import { OnboardingControlsProvider } from './context/OnboardingControlsContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AccountBootstrapProvider, useAccountBootstrap } from './context/AccountBootstrapContext';
import { BootstrapLoadingScreen } from './components/ui/BootstrapLoadingScreen';
import { QueryProvider } from './query/QueryProvider';
import Toast from 'react-native-toast-message';
import { navigationRef } from './navigation/navigationRef';
import {
  handleColdStartNotificationIfAny,
  subscribeNotificationOpenHandlers,
} from './services/notificationNavigationService';
import { scheduleAfterNativeReady } from './utils/scheduleAfterNativeReady';
import { resolveExpoNotificationsApi, unwrapExpoModule } from './utils/unwrapExpoModule';
import { RootErrorBoundary } from './components/RootErrorBoundary';
import { logger } from './utils/logger';
import { hydrateCategoryCache } from './services/aiCategoryCache';
import { RootNavigator } from './navigation/RootNavigator';
import { OnboardingFlowScreen } from './screens/onboarding/OnboardingFlowScreen';
import { SetPasswordAfterRecoveryScreen } from './screens/auth/SetPasswordAfterRecoveryScreen';
import { PremiumEntitlementProvider } from './context/PremiumEntitlementContext';
import { ContextualPaywallProvider } from './context/ContextualPaywallContext';
import { AppReviewProvider } from './context/AppReviewContext';
import { recordAppReviewSession } from './services/appReviewService';
import { recordColdStartFromLaunch } from './utils/perf';
import { ensureServerSubscriptionMirror } from './services/subscriptionEntitlementSyncService';
import { spacing } from './design/spacing';

/** Avoid top-level `expo-status-bar` — same eager native load as expo-linking. */
function DeferredStatusBar() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  if (!ready) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- defer status bar native module
    const { StatusBar } = require('expo-status-bar') as typeof import('expo-status-bar');
    return <StatusBar style="auto" />;
  } catch {
    return null;
  }
}

function MisconfiguredSupabaseShell() {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <MisconfiguredSupabaseView />
      <DeferredStatusBar />
    </View>
  );
}

function MisconfiguredSupabaseView() {
  const theme = useTheme();
  return (
    <View style={misconfigStyles.container}>
      <Text style={[theme.typography.title3, misconfigStyles.title, { color: theme.textPrimary }]}>
        Listio isn’t set up yet
      </Text>
      <Text style={[theme.typography.body, misconfigStyles.body, { color: theme.textSecondary }]}>
        This build can’t connect to Listio yet. If you installed from the App Store, contact support. Developers:
        add your Listio connection settings to .env and restart the app.
      </Text>
    </View>
  );
}

const misconfigStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  title: { marginBottom: spacing.md },
  body: { opacity: 0.95 },
});

function AppShell() {
  const { isAuthenticated, userId, userEmail } = useAuth();
  const misconfigured = isSupabaseSyncRequiredButMisconfigured();
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [replayOnboarding, setReplayOnboarding] = useState(false);
  /** null = checking RevenueCat; only used when `shouldEnforceIosSubscriptionGate()`. */
  const [subscriptionUnlocked, setSubscriptionUnlocked] = useState<boolean | null>(null);
  /** Always ready — RevenueCat identity sync runs in the background and reconciles via listeners. */
  const purchasesIdentityReady = true;
  const [navReady, setNavReady] = useState(false);
  /** After opening a password-recovery deep link, require a new password before the main app. */
  const [passwordRecoveryPending, setPasswordRecoveryPending] = useState(false);
  const lastConsumedAuthUrlRef = useRef<string | null>(null);
  const appReviewSessionRecordedRef = useRef(false);
  const coldStartRecordedRef = useRef(false);
  /** Never `undefined` — some navigation + Fabric paths misbehave with linking omitted on first paint. */
  const [linkingOpts, setLinkingOpts] = useState<LinkingOptions<RootStackParamList>>(
    () => buildRootLinkingOptions()
  );

  useEffect(() => {
    const { cancel } = scheduleAfterNativeReady(() => {
      setLinkingOpts(buildRootLinkingOptions());
    });
    return () => cancel();
  }, []);

  useEffect(() => {
    if (misconfigured) return;

    const handleUrl = async (url: string | null | undefined) => {
      if (!url || url === lastConsumedAuthUrlRef.current) return;
      const { ok, passwordRecovery } = await consumeSupabaseAuthFromUrl(url);
      if (!ok) return;
      lastConsumedAuthUrlRef.current = url;
      if (passwordRecovery) setPasswordRecoveryPending(true);
    };

    const sub = Linking.addEventListener('url', ({ url }) => {
      void handleUrl(url);
    });
    void Linking.getInitialURL().then((u) => handleUrl(u));

    return () => sub.remove();
  }, [misconfigured]);

  useEffect(() => {
    if (isAuthenticated === false) setPasswordRecoveryPending(false);
  }, [isAuthenticated]);

  useEffect(() => {
    if (misconfigured || !shouldEnforceIosSubscriptionGate()) return;
    void ensurePurchasesConfigured().then(() => installRevenueCatCustomerInfoListener());
    return subscribePremiumStatusChanges((isPremium) => {
      setSubscriptionUnlocked(isPremium);
    });
  }, [misconfigured]);

  /**
   * Sync RevenueCat identity in the background — never gates the loading screen. The
   * subscribed `subscribePremiumStatusChanges` listener reconciles entitlement state if
   * RevenueCat returns a different premium status than our optimistic assumption.
   */
  useEffect(() => {
    if (misconfigured) return;
    if (!shouldEnforceIosSubscriptionGate()) return;
    if (isAuthenticated === null) return;

    if (isAuthenticated !== true) {
      void syncPurchasesIdentity(null);
      return;
    }

    if (!userId) return;
    void syncPurchasesIdentity(userId, userEmail);
  }, [isAuthenticated, misconfigured, userId, userEmail]);

  useEffect(() => {
    if (misconfigured) return;
    if (isAuthenticated !== true) {
      setOnboardingComplete(null);
      return;
    }
    let cancelled = false;
    let onboardingSettled = false;
    setOnboardingComplete(null);

    const onboardingHangMs = 20_000;
    const onboardingTimeoutId = setTimeout(() => {
      if (cancelled || onboardingSettled) return;
      onboardingSettled = true;
      logger.warnRelease('Onboarding check timed out; defaulting to not completed');
      setOnboardingComplete(false);
    }, onboardingHangMs);

    isOnboardingCompleted()
      .then((done) => {
        if (cancelled || onboardingSettled) return;
        onboardingSettled = true;
        clearTimeout(onboardingTimeoutId);
        setOnboardingComplete(done);
      })
      .catch(() => {
        if (cancelled || onboardingSettled) return;
        onboardingSettled = true;
        clearTimeout(onboardingTimeoutId);
        setOnboardingComplete(false);
      });
    return () => {
      cancelled = true;
      clearTimeout(onboardingTimeoutId);
    };
  }, [isAuthenticated, misconfigured]);

  const resetOnboardingCompletion = useCallback(async () => {
    try {
      await clearOnboardingCompletion();
    } catch (e) {
      Alert.alert('Could not reset', e instanceof Error ? e.message : 'Unknown error');
      return;
    }
    setOnboardingComplete(false);
    setReplayOnboarding(false);
  }, []);

  const onboardingControls = useMemo(
    () => ({
      startReplayOnboarding: () => setReplayOnboarding(true),
      resetOnboardingCompletion,
    }),
    [resetOnboardingCompletion]
  );

  const bootstrapping = isAuthenticated === true && onboardingComplete === null;
  const { phase: bootstrapPhase } = useAccountBootstrap();

  const showOnboarding =
    isAuthenticated === true &&
    !bootstrapping &&
    (onboardingComplete === false || replayOnboarding);

  useEffect(() => {
    if (misconfigured) return;
    if (
      isAuthenticated !== true ||
      onboardingComplete !== true ||
      showOnboarding ||
      !purchasesIdentityReady
    ) {
      setSubscriptionUnlocked(null);
      return;
    }
    if (!shouldEnforceIosSubscriptionGate()) {
      setSubscriptionUnlocked(true);
      return;
    }
    let cancelled = false;
    let entitlementSettled = false;
    setSubscriptionUnlocked(null);

    // Matches the getSession/onboarding 20s timeout so a hung RevenueCat call
    // can't wedge the splash safety timer. Fail *closed* (locked) to preserve
    // App Store-review-safe semantics; legitimate paid users can unlock via the
    // paywall's Restore Purchases button if the entitlement arrives after.
    const entitlementHangMs = 20_000;
    const entitlementTimeoutId = setTimeout(() => {
      if (cancelled || entitlementSettled) return;
      entitlementSettled = true;
      logger.warnRelease(
        `fetchPremiumEntitlementActive timed out after ${entitlementHangMs}ms; defaulting to locked`
      );
      setSubscriptionUnlocked(false);
    }, entitlementHangMs);

    void fetchPremiumEntitlementActive()
      .then((ok) => {
        if (cancelled || entitlementSettled) return;
        entitlementSettled = true;
        clearTimeout(entitlementTimeoutId);
        setSubscriptionUnlocked(ok);
        if (ok) void ensureServerSubscriptionMirror();
      })
      .catch((e) => {
        if (cancelled || entitlementSettled) return;
        entitlementSettled = true;
        clearTimeout(entitlementTimeoutId);
        logger.warnRelease('fetchPremiumEntitlementActive rejected', e);
        setSubscriptionUnlocked(false);
      });

    return () => {
      cancelled = true;
      clearTimeout(entitlementTimeoutId);
    };
  }, [misconfigured, isAuthenticated, onboardingComplete, showOnboarding, purchasesIdentityReady]);

  const handleOnboardingUiFinished = useCallback(() => {
    setOnboardingComplete(true);
    setReplayOnboarding(false);
  }, []);

  const isPremium = !shouldEnforceIosSubscriptionGate() ? true : subscriptionUnlocked === true;
  const isPremiumLoading =
    shouldEnforceIosSubscriptionGate() &&
    purchasesIdentityReady &&
    subscriptionUnlocked === null &&
    isAuthenticated === true &&
    onboardingComplete === true &&
    !showOnboarding;

  /** Bootstrap gates: auth + onboarding resolved. Home bundle is fetched by BootstrapLoadingScreen. */
  const mainAppGatesPassed =
    isAuthenticated === true &&
    !bootstrapping &&
    onboardingComplete === true &&
    !showOnboarding &&
    purchasesIdentityReady;

  /** Data + UX gates: only true after BootstrapLoadingScreen has handed off (progress finished). */
  const mainAppActive = mainAppGatesPassed && bootstrapPhase === 'complete';

  /** Anything outside the auth flow that hasn't finished bootstrapping needs the loading screen. */
  const needsBootstrapLoading =
    !misconfigured &&
    isAuthenticated !== false &&
    !(isAuthenticated === true && passwordRecoveryPending) &&
    !showOnboarding &&
    !mainAppActive;

  useEffect(() => {
    if (!navReady || !mainAppActive || coldStartRecordedRef.current) return;
    coldStartRecordedRef.current = true;
    recordColdStartFromLaunch();
  }, [navReady, mainAppActive]);

  useEffect(() => {
    if (!navReady || !mainAppActive) return;
    handleColdStartNotificationIfAny();
  }, [navReady, mainAppActive]);

  useEffect(() => {
    if (!navReady || !mainAppActive) return;
    return subscribeNotificationOpenHandlers();
  }, [navReady, mainAppActive]);

  useEffect(() => {
    if (!mainAppActive || appReviewSessionRecordedRef.current) return;
    appReviewSessionRecordedRef.current = true;
    void recordAppReviewSession();
  }, [mainAppActive]);

  /** Keep Supabase entitlement mirror warm off the AI hot path. */
  useEffect(() => {
    if (!mainAppActive) return;
    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        void ensureServerSubscriptionMirror();
      }
    });
    return () => sub.remove();
  }, [mainAppActive]);

  // Keep the native launch screen up until we're actually ready to render real UI —
  // not a `<LoadingGate />`. Without this, users briefly see the branded splash,
  // then an ActivityIndicator, then the app. With this they only ever see the splash
  // transition straight into auth / onboarding / main app.
  const readyToRenderRealUi =
    misconfigured ||
    isAuthenticated === false ||
    (isAuthenticated === true && passwordRecoveryPending) ||
    showOnboarding ||
    mainAppActive;

  useEffect(() => {
    if (!readyToRenderRealUi) return;
    // Defer by one frame so the first frame of the real UI has painted before we
    // pull the splash down — avoids a one-frame flash of background color.
    const id = requestAnimationFrame(() => {
      void SplashScreen.hideAsync().catch(() => {
        /* already hidden (e.g. safety timeout fired) — safe to ignore */
      });
    });
    return () => cancelAnimationFrame(id);
  }, [readyToRenderRealUi]);

  if (misconfigured) {
    return (
      <MisconfiguredSupabaseShell />
    );
  }

  return (
    <SafeAreaProvider>
      <OnboardingControlsProvider value={onboardingControls}>
        <NavigationContainer
          ref={navigationRef}
          linking={linkingOpts}
          onReady={() => setNavReady(true)}
        >
          {isAuthenticated === true && passwordRecoveryPending ? (
            <SetPasswordAfterRecoveryScreen
              onFinished={() => setPasswordRecoveryPending(false)}
            />
          ) : isAuthenticated === false ? (
            <AuthNavigator />
          ) : showOnboarding ? (
            <OnboardingFlowScreen onFinished={handleOnboardingUiFinished} />
          ) : needsBootstrapLoading ? (
            <BootstrapLoadingScreen homeFetchAllowed={mainAppGatesPassed} />
          ) : (
            <PremiumEntitlementProvider isPremium={isPremium} isPremiumLoading={isPremiumLoading}>
              <AppReviewProvider>
                <ContextualPaywallProvider
                  onPremiumStatusKnown={(ok) => {
                    if (ok) setSubscriptionUnlocked(true);
                  }}
                >
                  <RootNavigator />
                </ContextualPaywallProvider>
              </AppReviewProvider>
            </PremiumEntitlementProvider>
          )}
          <DeferredStatusBar />
        </NavigationContainer>
      </OnboardingControlsProvider>
    </SafeAreaProvider>
  );
}

function applyNotificationHandler(
  api: NonNullable<ReturnType<typeof resolveExpoNotificationsApi>>
): void {
  api.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Absolute upper bound before we force-hide the native splash, so a hung auth/RevenueCat
 *  call can never leave users staring at the launch screen forever. Set just under the
 *  25s getSession() timeout inside AppShell so we never fall through to `LoadingGate` on
 *  normal-but-slow networks, but still unblock the UI if the whole bootstrap wedges.
 *
 *  Dev builds get a larger budget because Metro compiles dynamic `import()` targets on
 *  demand and iOS simulator StoreKit can stall `Purchases.getCustomerInfo` — both of
 *  which legitimately take longer than 20s under `npx expo start --clear` but don't
 *  exist in release IPAs. Keep the prod value at 20s so real users aren't held hostage. */
const SPLASH_SAFETY_TIMEOUT_MS = __DEV__ ? 60_000 : 20_000;

function App() {
  // Load the brand display typeface before mounting AppShell so titles never
  // flash in the system font first. The native splash stays up until ready, and
  // a load failure falls through to the system font rather than blocking boot.
  const [fontsLoaded, fontsError] = useFonts(appFontAssets);
  const fontsReady = fontsLoaded || !!fontsError;

  useEffect(() => {
    if (fontsError) {
      logger.warnRelease('expo-font: brand typeface failed to load', fontsError);
    }
  }, [fontsError]);

  useEffect(() => {
    const t = setTimeout(() => {
      // If this fires in the wild it means AppShell never reached a terminal state
      // (auth / onboarding / main app / misconfigured) within the budget.
      // We still hide the splash so the user sees *something*, but we want to know
      // how often this happens in production to tune the timeout.
      logger.warnRelease(
        `SplashScreen safety timeout fired after ${SPLASH_SAFETY_TIMEOUT_MS}ms — forcing hide`
      );
      void SplashScreen.hideAsync().catch(() => {
        /* already hidden — safe to ignore */
      });
    }, SPLASH_SAFETY_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    // Populate the in-memory AI categorization cache so the composer submit path
    // can branch synchronously on cache hits (no `await` before inserting).
    void hydrateCategoryCache();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const tryInstallFromRequire = (): boolean => {
      const api = resolveExpoNotificationsApi();
      if (api?.setNotificationHandler) {
        applyNotificationHandler(api);
        return true;
      }
      return false;
    };

    const tryInstallFromDynamicImport = (): void => {
      void import('expo-notifications')
        .then((raw) => {
          if (cancelled) return;
          const api = unwrapExpoModule(raw, (x) => typeof x.setNotificationHandler === 'function') as
            | ReturnType<typeof resolveExpoNotificationsApi>
            | null;
          if (api?.setNotificationHandler) applyNotificationHandler(api);
        })
        .catch((e) => {
          logger.warnRelease('expo-notifications: could not load module', e);
        });
    };

    const run = (): void => {
      if (cancelled) return;
      if (tryInstallFromRequire()) return;
      requestAnimationFrame(() => {
        if (cancelled) return;
        if (tryInstallFromRequire()) return;
        tryInstallFromDynamicImport();
      });
    };

    const { cancel } = scheduleAfterNativeReady(run);
    return () => {
      cancelled = true;
      cancel();
    };
  }, []);

  return (
    <RootErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardProvider>
          <ThemeProvider>
            <ThemedAppChrome>
              <QueryProvider>
                <AuthProvider>
                  <AccountBootstrapProvider>
                    {fontsReady ? <AppShell /> : null}
                  </AccountBootstrapProvider>
                </AuthProvider>
              </QueryProvider>
              <Toast />
            </ThemedAppChrome>
          </ThemeProvider>
        </KeyboardProvider>
      </GestureHandlerRootView>
    </RootErrorBoundary>
  );
}

function ThemedAppChrome({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return <View style={{ flex: 1, backgroundColor: theme.background }}>{children}</View>;
}

App.displayName = 'App';
export default App;
