import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../design/ThemeContext';
import { isSyncEnabled } from '../../services/supabaseClient';
import { markOnboardingCompleted } from '../../services/onboardingService';
import {
  fetchPremiumEntitlementActive,
  presentPaywallForPurchase,
  shouldEnforceIosSubscriptionGate,
} from '../../services/purchasesService';
import { SubscriptionLegalLinks } from '../../components/subscription/SubscriptionLegalLinks';
import { LISTIO_PLUS_ANNUAL_USD_LABEL, LISTIO_PLUS_MONTHLY_USD_LABEL } from '../../constants/subscription';
import { createOnboardingLayout, onboardingPageGradient } from './onboardingTokens';
import { OnboardingTopChrome } from '../../components/onboarding/OnboardingTopChrome';
import { OnboardingBottomCta } from '../../components/onboarding/OnboardingBottomCta';
import { OnboardingAnimatedStep } from '../../components/onboarding/OnboardingAnimatedStep';
import { OnboardingWelcomeFeatured } from '../../components/onboarding/OnboardingWelcomeFeatured';
import { OnboardingListFeatured } from '../../components/onboarding/OnboardingListFeatured';
import { OnboardingMealsFeatured } from '../../components/onboarding/OnboardingMealsFeatured';
import { OnboardingRecipesFeatured } from '../../components/onboarding/OnboardingRecipesFeatured';
import { OnboardingFinishFeatured } from '../../components/onboarding/OnboardingFinishFeatured';
import { OnboardingShoppingRhythmFeatured } from '../../components/onboarding/OnboardingShoppingRhythmFeatured';
import { patchUserPreferences } from '../../services/userPreferencesService';
import { requestNotificationPermissionsPrompting } from '../../services/notificationSchedulingService';
import { refreshDynamicNotifications } from '../../services/notificationRefreshService';
import { registerAndSyncPushToken } from '../../services/pushTokenService';
import type { ShoppingTimeBucket } from '../../services/notificationTimeUtils';

const STEP_COUNT = 6;

/** Runs after sign-in when Supabase is configured. */

type Props = {
  onFinished: () => void | Promise<void>;
};

export function OnboardingFlowScreen({ onFinished }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [finishBusy, setFinishBusy] = useState(false);
  const [routineSaveBusy, setRoutineSaveBusy] = useState(false);
  const [shoppingWeekdays, setShoppingWeekdays] = useState<number[]>([]);
  const [shoppingTimeBucket, setShoppingTimeBucket] = useState<ShoppingTimeBucket>('evening');

  const isDark = theme.colorScheme === 'dark';
  const gradientColors = isDark ? onboardingPageGradient.dark : onboardingPageGradient.light;
  const onboardingLayout = useMemo(() => createOnboardingLayout(theme.spacing), [theme]);

  const advanceFromShoppingStep = async (): Promise<boolean> => {
    if (!isSyncEnabled()) {
      await requestNotificationPermissionsPrompting();
      return true;
    }
    const sorted = [...shoppingWeekdays].sort((a, b) => a - b);
    if (sorted.length === 0) {
      Alert.alert('Pick day(s)', 'Choose at least one day you usually shop.');
      return false;
    }
    try {
      await patchUserPreferences({
        notifications: {
          shoppingWeekdays: sorted,
          shoppingTimeBucket: shoppingTimeBucket,
          usePersonalizedShoppingReminders: true,
          mealReminders: true,
          mealReminderMode: 'planned_only',
          shoppingReminders: true,
        },
      });
      await requestNotificationPermissionsPrompting();
      await refreshDynamicNotifications();
      await registerAndSyncPushToken();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Unknown error');
      return false;
    }
    return true;
  };

  /** Paywall is gated here (between Recipes and the final "ready to go" step) rather than on the
   *  "Get started" button so users actually get to see the confirmation page before landing on
   *  the List tab. Returns true if the user is (or just became) premium and should advance. */
  const ensureSubscriptionActiveBeforeFinalStep = async (): Promise<boolean> => {
    try {
      const alreadyPremium = await fetchPremiumEntitlementActive();
      if (alreadyPremium) return true;
      const purchased = await presentPaywallForPurchase();
      return purchased;
    } catch (e) {
      Alert.alert('Something went wrong', e instanceof Error ? e.message : 'Unknown error');
      return false;
    }
  };

  const handleCta = async () => {
    if (step < STEP_COUNT - 1) {
      if (step === 3) {
        setRoutineSaveBusy(true);
        try {
          const ok = await advanceFromShoppingStep();
          if (!ok) return;
        } finally {
          setRoutineSaveBusy(false);
        }
      }
      if (step === STEP_COUNT - 2) {
        setFinishBusy(true);
        try {
          const okToAdvance = await ensureSubscriptionActiveBeforeFinalStep();
          if (!okToAdvance) return;
        } finally {
          setFinishBusy(false);
        }
      }
      setStep((s) => s + 1);
      return;
    }
    await finish();
  };

  const finish = async () => {
    setFinishBusy(true);
    try {
      await markOnboardingCompleted();
      await onFinished();
    } catch (e) {
      Alert.alert('Something went wrong', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setFinishBusy(false);
    }
  };

  const ctaLabel = step < STEP_COUNT - 1 ? (step === 0 ? 'Continue' : 'Next') : 'Get started';

  const scrollBottomPad = onboardingLayout.scrollBottomInset + insets.bottom;

  return (
    <View style={styles.root}>
      <LinearGradient colors={[...gradientColors]} style={StyleSheet.absoluteFillObject} />

      <OnboardingTopChrome stepIndex={step} totalSteps={STEP_COUNT} topInset={insets.top} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: onboardingLayout.horizontalPadding,
            paddingBottom: scrollBottomPad,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === 0 ? (
          <OnboardingAnimatedStep stepKey={step}>
            <Text style={[theme.typography.title2, { color: theme.textPrimary, marginBottom: onboardingLayout.headlineToBody }]}>
              Plan meals, build your list, then shop
            </Text>
            <Text
              style={[
                theme.typography.body,
                {
                  color: theme.textSecondary,
                  lineHeight: 24,
                  marginBottom: onboardingLayout.firstPageBodyToFeatured,
                },
              ]}
            >
              Listio centers on three tabs:{' '}
              <Text style={{ fontWeight: '600', color: theme.textPrimary }}>List</Text> with <Text style={{ fontWeight: '600', color: theme.textPrimary }}>Plan</Text> and{' '}
              <Text style={{ fontWeight: '600', color: theme.textPrimary }}>Shop</Text>, <Text style={{ fontWeight: '600', color: theme.textPrimary }}>Meals</Text> for the week, and{' '}
              <Text style={{ fontWeight: '600', color: theme.textPrimary }}>Recipes</Text> for dishes you return to often. They stay connected so you are not retyping ingredients.
            </Text>
            <OnboardingWelcomeFeatured />
          </OnboardingAnimatedStep>
        ) : null}

        {step === 1 ? (
          <OnboardingAnimatedStep stepKey={step}>
            <Text style={[theme.typography.title2, { color: theme.textPrimary, marginBottom: onboardingLayout.headlineToBody }]}>
              Your list in Plan and Shop
            </Text>
            <Text style={[theme.typography.body, { color: theme.textSecondary, lineHeight: 24, marginBottom: onboardingLayout.bodyToFeatured }]}>
              Use <Text style={{ fontWeight: '600', color: theme.textPrimary }}>Plan</Text> to add items, quantities, and notes. Switch to{' '}
              <Text style={{ fontWeight: '600', color: theme.textPrimary }}>Shop</Text> when you head out — checkboxes and per-section counts keep the trip focused.
            </Text>
            <OnboardingListFeatured />
            <Text style={[theme.typography.footnote, { color: theme.textSecondary, marginTop: theme.spacing.md, lineHeight: 19 }]}>
              Items group by section so the order follows how you walk the aisles.
            </Text>
          </OnboardingAnimatedStep>
        ) : null}

        {step === 2 ? (
          <OnboardingAnimatedStep stepKey={step}>
            <Text style={[theme.typography.title2, { color: theme.textPrimary, marginBottom: onboardingLayout.headlineToBody }]}>
              Meals for the week
            </Text>
            <Text style={[theme.typography.body, { color: theme.textSecondary, lineHeight: 24, marginBottom: onboardingLayout.bodyToFeatured }]}>
              See what you are cooking at a glance. When it is time to stock up, move ingredients from a meal straight into your list instead of juggling notes.
            </Text>
            <OnboardingMealsFeatured />
            <Text style={[theme.typography.footnote, { color: theme.textSecondary, marginTop: theme.spacing.md, lineHeight: 19 }]}>
              Open the <Text style={{ fontWeight: '600', color: theme.textPrimary }}>Meals</Text> tab anytime to adjust the plan.
            </Text>
          </OnboardingAnimatedStep>
        ) : null}

        {step === 3 ? (
          <OnboardingAnimatedStep stepKey={step}>
            <Text style={[theme.typography.title2, { color: theme.textPrimary, marginBottom: onboardingLayout.headlineToBody }]}>
              Reminders that fit your shopping
            </Text>
            <Text style={[theme.typography.body, { color: theme.textSecondary, lineHeight: 24, marginBottom: onboardingLayout.bodyToFeatured }]}>
              Tell us when you usually shop so we can nudge you to prep your list and review it before you head out.
            </Text>
            <OnboardingShoppingRhythmFeatured
              syncEnabled={isSyncEnabled()}
              selectedDays={shoppingWeekdays}
              onChangeDays={setShoppingWeekdays}
              timeBucket={shoppingTimeBucket}
              onChangeBucket={setShoppingTimeBucket}
            />
          </OnboardingAnimatedStep>
        ) : null}

        {step === 4 ? (
          <OnboardingAnimatedStep stepKey={step}>
            <Text style={[theme.typography.title2, { color: theme.textPrimary, marginBottom: onboardingLayout.headlineToBody }]}>
              Recipes you actually cook
            </Text>
            <Text style={[theme.typography.body, { color: theme.textSecondary, lineHeight: 24, marginBottom: onboardingLayout.bodyToFeatured }]}>
              Save recipes with ingredients lined up the way you think about them. One action sends everything you need into <Text style={{ fontWeight: '600', color: theme.textPrimary }}>Plan</Text> so your list stays the single source of truth.
            </Text>
            <OnboardingRecipesFeatured />
            <Text style={[theme.typography.footnote, { color: theme.textSecondary, marginTop: theme.spacing.md, lineHeight: 19 }]}>
              Browse and edit saved recipes from the <Text style={{ fontWeight: '600', color: theme.textPrimary }}>Recipes</Text> tab.
            </Text>
          </OnboardingAnimatedStep>
        ) : null}

        {step === 5 ? (
          <OnboardingAnimatedStep stepKey={step}>
            <Text style={[theme.typography.title2, { color: theme.textPrimary, marginBottom: onboardingLayout.headlineToBody }]}>
              You are ready to go
            </Text>
            <Text style={[theme.typography.body, { color: theme.textSecondary, lineHeight: 24, marginBottom: onboardingLayout.bodyToFeatured }]}>
              Use <Text style={{ fontWeight: '600', color: theme.textPrimary }}>List</Text> as home base, jump to <Text style={{ fontWeight: '600', color: theme.textPrimary }}>Meals</Text> and{' '}
              <Text style={{ fontWeight: '600', color: theme.textPrimary }}>Recipes</Text> from the tab bar, and tweak reminders or appearance in <Text style={{ fontWeight: '600', color: theme.textPrimary }}>Settings</Text>.
            </Text>
            <OnboardingFinishFeatured />
            {Platform.OS === 'ios' && shouldEnforceIosSubscriptionGate() ? (
              <View style={{ marginTop: theme.spacing.lg, alignItems: 'center' }}>
                <Text
                  style={[
                    theme.typography.footnote,
                    {
                      color: theme.textSecondary,
                      textAlign: 'center',
                      lineHeight: 20,
                      marginBottom: theme.spacing.sm,
                    },
                  ]}
                >
                  Listio+ is active ({LISTIO_PLUS_MONTHLY_USD_LABEL} or {LISTIO_PLUS_ANNUAL_USD_LABEL}, auto-renewing).
                </Text>
                <Text
                  style={[
                    theme.typography.footnote,
                    {
                      color: theme.textSecondary,
                      textAlign: 'center',
                      lineHeight: 19,
                      marginBottom: theme.spacing.sm,
                    },
                  ]}
                >
                  Your subscription automatically renews for the same term at the standard price shown on the App
                  Store unless auto-renew is turned off at least 24 hours before the end of the current period. Your
                  account will be charged for renewal within 24 hours prior to the end of the current period. Manage
                  or cancel your subscription in the App Store under Account → Subscriptions.
                </Text>
                <SubscriptionLegalLinks />
              </View>
            ) : null}
          </OnboardingAnimatedStep>
        ) : null}
      </ScrollView>

      <OnboardingBottomCta
        bottomInset={insets.bottom}
        label={ctaLabel}
        onPress={() => {
          void handleCta();
        }}
        loading={
          (finishBusy && (step === STEP_COUNT - 2 || step === STEP_COUNT - 1)) ||
          (routineSaveBusy && step === 3)
        }
        disabled={
          (finishBusy && (step === STEP_COUNT - 2 || step === STEP_COUNT - 1)) ||
          (routineSaveBusy && step === 3)
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 0,
  },
});
