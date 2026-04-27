import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, Linking } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import type { LinkingOptions } from '@react-navigation/native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, useTheme } from './design/ThemeContext';
import { AuthNavigator } from './navigation/AuthNavigator';
import type { RootStackParamList } from './navigation/types';
import { buildRootLinkingOptions } from './navigation/linking';
import {
  supabase,
  getUserId,
  isSupabaseSyncRequiredButMisconfigured,
  signOutLocallyIfCorruptRefreshToken,
} from './services/supabaseClient';
import { consumeSupabaseAuthFromUrl } from './services/authDeepLink';
import {
  fetchPremiumEntitlementActive,
  shouldEnforceIosSubscriptionGate,
  syncPurchasesIdentity,
} from './services/purchasesService';
import { isOnboardingCompleted, clearOnboardingCompletion } from './services/onboardingService';
import { OnboardingControlsProvider } from './context/OnboardingControlsContext';
import { AuthUserIdProvider } from './context/AuthUserIdContext';
import { QueryProvider } from './query/QueryProvider';
import { useQueryClient } from '@tanstack/react-query';
import { clearPersistedQueryCache } from './query/reactQueryPersistence';
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
import { SubscriptionGateScreen } from './screens/subscription/SubscriptionGateScreen';
import { SetPasswordAfterRecoveryScreen } from './screens/auth/SetPasswordAfterRecoveryScreen';
import { spacing } from './design/spacing';

/** Lazily imported on first sign-in; keeps the import path out of the initial JS bundle. */
function maybeImportLocalDataOnSignInLazy(uid: string): Promise<void> {
  return import('./services/localToCloudImportService')
    .then((m) => m.maybeImportLocalDataOnSignIn(uid))
    .catch(() => undefined);
}

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
        Supabase is not configured
      </Text>
      <Text style={[theme.typography.body, misconfigStyles.body, { color: theme.textSecondary }]}>
        Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your .env file and restart Expo
        (npx expo start --clear). This build requires Supabase for sign-in and cloud data.
      </Text>
    </View>
  );
}

const misconfigStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  title: { marginBottom: spacing.md },
  body: { opacity: 0.95 },
});

const loadingStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});

function LoadingGate() {
  const theme = useTheme();
  return (
    <View style={[loadingStyles.container, { backgroundColor: theme.background }]}>
      <ActivityIndicator size="large" color={theme.accent} />
    </View>
  );
}

function AppShell() {
  const queryClient = useQueryClient();
  const misconfigured = isSupabaseSyncRequiredButMisconfigured();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [replayOnboarding, setReplayOnboarding] = useState(false);
  /** null = checking RevenueCat; only used when `shouldEnforceIosSubscriptionGate()`. */
  const [subscriptionUnlocked, setSubscriptionUnlocked] = useState<boolean | null>(null);
  const [purchasesIdentityReady, setPurchasesIdentityReady] = useState<boolean>(
    !shouldEnforceIosSubscriptionGate()
  );
  const [navReady, setNavReady] = useState(false);
  /** After opening a password-recovery deep link, require a new password before the main app. */
  const [passwordRecoveryPending, setPasswordRecoveryPending] = useState(false);
  const lastConsumedAuthUrlRef = useRef<string | null>(null);
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

    let subscription: { unsubscribe: () => void } | null = null;
    let cancelled = false;

    const sessionHangMs = 25_000;
    const sessionTimeoutId = setTimeout(() => {
      setIsAuthenticated((prev) => (prev === null ? false : prev));
    }, sessionHangMs);

    void (async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (cancelled) return;

        if (error) {
          const cleared = await signOutLocallyIfCorruptRefreshToken(error);
          if (cleared) {
            await clearPersistedQueryCache();
            queryClient.clear();
          }
          setIsAuthenticated(false);
        } else {
          setIsAuthenticated(!!session?.user);
          const uid = session?.user?.id;
          if (uid) {
            void maybeImportLocalDataOnSignInLazy(uid);
          }
        }
      } catch {
        if (!cancelled) setIsAuthenticated(false);
      } finally {
        if (!cancelled) clearTimeout(sessionTimeoutId);
      }

      if (cancelled) return;

      try {
        const sub = supabase.auth.onAuthStateChange((_event, nextSession) => {
          setIsAuthenticated(!!nextSession?.user);
          const uid = nextSession?.user?.id;
          if (uid) {
            void maybeImportLocalDataOnSignInLazy(uid);
          }
        });
        subscription = sub.data.subscription;
      } catch {
        setIsAuthenticated(false);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(sessionTimeoutId);
      subscription?.unsubscribe();
    };
  }, [misconfigured, queryClient]);

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
    if (misconfigured) return;
    if (!shouldEnforceIosSubscriptionGate()) {
      setPurchasesIdentityReady(true);
      return;
    }

    let cancelled = false;
    const syncIdentity = async () => {
      if (isAuthenticated !== true) {
        setPurchasesIdentityReady(true);
        await syncPurchasesIdentity(null);
        return;
      }

      setPurchasesIdentityReady(false);
      const uid = await getUserId();
      if (cancelled) return;
      await syncPurchasesIdentity(uid);
      if (!cancelled) setPurchasesIdentityReady(true);
    };

    void syncIdentity();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, misconfigured]);

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

  const subscriptionBootstrapping =
    isAuthenticated === true &&
    !bootstrapping &&
    onboardingComplete === true &&
    !showOnboarding &&
    shouldEnforceIosSubscriptionGate() &&
    (!purchasesIdentityReady || subscriptionUnlocked === null);

  const showSubscriptionGate =
    isAuthenticated === true &&
    !bootstrapping &&
    onboardingComplete === true &&
    !showOnboarding &&
    shouldEnforceIosSubscriptionGate() &&
    purchasesIdentityReady &&
    subscriptionUnlocked === false;

  const handleSubscriptionUnlocked = useCallback(() => {
    setSubscriptionUnlocked(true);
  }, []);

  const subscriptionAllowsMainNav =
    !shouldEnforceIosSubscriptionGate() || subscriptionUnlocked === true;

  const mainAppActive =
    isAuthenticated === true &&
    !bootstrapping &&
    onboardingComplete === true &&
    !showOnboarding &&
    subscriptionAllowsMainNav;

  useEffect(() => {
    if (!navReady || !mainAppActive) return;
    handleColdStartNotificationIfAny();
  }, [navReady, mainAppActive]);

  useEffect(() => {
    if (!navReady || !mainAppActive) return;
    return subscribeNotificationOpenHandlers();
  }, [navReady, mainAppActive]);

  // Keep the native launch screen up until we're actually ready to render real UI —
  // not a `<LoadingGate />`. Without this, users briefly see the branded splash,
  // then an ActivityIndicator, then the app. With this they only ever see the splash
  // transition straight into auth / onboarding / paywall / main app.
  const readyToRenderRealUi =
    misconfigured ||
    isAuthenticated === false ||
    (isAuthenticated === true && passwordRecoveryPending) ||
    showOnboarding ||
    showSubscriptionGate ||
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
          {isAuthenticated === null ? (
            <LoadingGate />
          ) : isAuthenticated === true && passwordRecoveryPending ? (
            <SetPasswordAfterRecoveryScreen
              onFinished={() => setPasswordRecoveryPending(false)}
            />
          ) : !isAuthenticated ? (
            <AuthNavigator />
          ) : bootstrapping ? (
            <LoadingGate />
          ) : showOnboarding ? (
            <OnboardingFlowScreen onFinished={handleOnboardingUiFinished} />
          ) : subscriptionBootstrapping ? (
            <LoadingGate />
          ) : showSubscriptionGate ? (
            <SubscriptionGateScreen onUnlocked={handleSubscriptionUnlocked} />
          ) : (
            <RootNavigator />
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
  useEffect(() => {
    const t = setTimeout(() => {
      // If this fires in the wild it means AppShell never reached a terminal state
      // (auth / onboarding / paywall / main app / misconfigured) within the budget.
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
        <ThemeProvider>
          <ThemedAppChrome>
            <QueryProvider>
              <AuthUserIdProvider>
                <AppShell />
              </AuthUserIdProvider>
            </QueryProvider>
            <Toast />
          </ThemedAppChrome>
        </ThemeProvider>
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
