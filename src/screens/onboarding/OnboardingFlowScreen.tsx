import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Platform, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../design/ThemeContext';
import { isSyncEnabled } from '../../services/supabaseClient';
import { markOnboardingCompleted } from '../../services/onboardingService';
import { shouldEnforceIosSubscriptionGate } from '../../services/purchasesService';
import { SubscriptionLegalLinks } from '../../components/subscription/SubscriptionLegalLinks';
import { LISTIO_PLUS_ANNUAL_USD_LABEL, LISTIO_PLUS_MONTHLY_USD_LABEL } from '../../constants/subscription';
import {
  FREE_LIST_ITEMS_LIMIT,
  FREE_MEALS_LIMIT,
  FREE_RECIPES_LIMIT,
} from '../../services/freeTierLimits';
import { createOnboardingLayout, onboardingPageGradient } from './onboardingTokens';
import { OnboardingTopChrome } from '../../components/onboarding/OnboardingTopChrome';
import { OnboardingBottomCta } from '../../components/onboarding/OnboardingBottomCta';
import { OnboardingAnimatedStep } from '../../components/onboarding/OnboardingAnimatedStep';
import { OnboardingStepHeader } from '../../components/onboarding/OnboardingStepHeader';
import { OnboardingWelcomeFeatured } from '../../components/onboarding/OnboardingWelcomeFeatured';
import { OnboardingFinishFeatured } from '../../components/onboarding/OnboardingFinishFeatured';
import { OnboardingShoppingRhythmFeatured } from '../../components/onboarding/OnboardingShoppingRhythmFeatured';
import { OnboardingTabsOrientation } from '../../components/onboarding/OnboardingTabsOrientation';
import { OnboardingStagger } from '../../components/onboarding/OnboardingStagger';
import { patchUserPreferences } from '../../services/userPreferencesService';
import { requestNotificationPermissionsPrompting } from '../../services/notificationSchedulingService';
import { refreshDynamicNotifications } from '../../services/notificationRefreshService';
import { registerAndSyncPushToken } from '../../services/pushTokenService';
import type { ShoppingTimeBucket } from '../../services/notificationTimeUtils';

const STEP_COUNT = 4;
const ORIENTATION_STEP = 1;
const REMINDERS_STEP = 2;
const FINISH_STEP = 3;

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
  const [legalTermsExpanded, setLegalTermsExpanded] = useState(false);

  const isDark = theme.colorScheme === 'dark';
  const gradientColors = isDark ? onboardingPageGradient.dark : onboardingPageGradient.light;
  const onboardingLayout = useMemo(
    () => createOnboardingLayout(theme.spacing, theme.layoutScale),
    [theme],
  );

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

  const skipReminders = useCallback(async () => {
    await requestNotificationPermissionsPrompting();
    setStep(FINISH_STEP);
  }, []);

  const handleCta = async () => {
    if (step < STEP_COUNT - 1) {
      if (step === REMINDERS_STEP) {
        setRoutineSaveBusy(true);
        try {
          const ok = await advanceFromShoppingStep();
          if (!ok) return;
        } finally {
          setRoutineSaveBusy(false);
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

  const ctaLabel =
    step < STEP_COUNT - 1 ? (step === 0 ? 'Continue' : step === REMINDERS_STEP ? 'Next' : 'Next') : 'Get started';

  const scrollExtraForFooter =
    step === FINISH_STEP && Platform.OS === 'ios' && shouldEnforceIosSubscriptionGate() ? 168 : 0;
  const scrollBottomPad = onboardingLayout.scrollBottomInset + insets.bottom + scrollExtraForFooter;

  const legalFooter =
    Platform.OS === 'ios' && shouldEnforceIosSubscriptionGate() ? (
      <View style={{ alignItems: 'center' }}>
        <Text
          style={[
            theme.typography.caption2,
            {
              color: theme.textSecondary,
              textAlign: 'center',
              lineHeight: 15,
              marginBottom: theme.spacing.xs,
            },
          ]}
        >
          Free plan: up to {FREE_LIST_ITEMS_LIMIT} list items, {FREE_MEALS_LIMIT} meal, and {FREE_RECIPES_LIMIT} recipe.
          Listio+ ({LISTIO_PLUS_MONTHLY_USD_LABEL} or {LISTIO_PLUS_ANNUAL_USD_LABEL}, auto-renewing) unlocks unlimited
          use, recipe imports, Smart add, and more.
        </Text>
        <Pressable
          onPress={() => setLegalTermsExpanded((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: legalTermsExpanded }}
          accessibilityLabel="Subscription terms"
          style={{ minHeight: 44, justifyContent: 'center', marginBottom: theme.spacing.xs }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xs }}>
            <Text style={[theme.typography.caption2, { color: theme.textSecondary, fontWeight: '600' }]}>
              Subscription terms
            </Text>
            <Ionicons
              name={legalTermsExpanded ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={theme.textSecondary}
            />
          </View>
        </Pressable>
        {legalTermsExpanded ? (
          <Text
            style={[
              theme.typography.caption2,
              {
                color: theme.textSecondary,
                textAlign: 'center',
                lineHeight: 15,
                marginBottom: theme.spacing.sm,
              },
            ]}
          >
            If you subscribe, your subscription automatically renews for the same term at the standard price shown on
            the App Store unless auto-renew is turned off at least 24 hours before the end of the current period. Your
            account will be charged for renewal within 24 hours prior to the end of the current period. Manage or cancel
            your subscription in the App Store under Account → Subscriptions.
          </Text>
        ) : null}
        <SubscriptionLegalLinks compact />
      </View>
    ) : null;

  const secondaryAction =
    step === FINISH_STEP
      ? null
      : step === REMINDERS_STEP
        ? {
            label: 'Skip reminders',
            accessibilityLabel: 'Skip reminders. You can enable them later in Settings.',
            onPress: () => {
              void skipReminders();
            },
          }
        : {
            label: 'Skip',
            onPress: () => {
              if (step === 0) setStep(1);
              else if (step === ORIENTATION_STEP) setStep(REMINDERS_STEP);
            },
          };

  return (
    <View style={styles.root}>
      <LinearGradient colors={[...gradientColors]} style={StyleSheet.absoluteFillObject} />
      {isDark ? (
        <LinearGradient
          colors={['transparent', theme.accent + '08']}
          style={[StyleSheet.absoluteFillObject, styles.accentGlow]}
          pointerEvents="none"
        />
      ) : null}

      <OnboardingTopChrome stepIndex={step} totalSteps={STEP_COUNT} topInset={insets.top} showProgress />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: onboardingLayout.horizontalPadding,
            paddingBottom: scrollBottomPad,
            paddingTop: onboardingLayout.contentTopPadding,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === 0 ? (
          <OnboardingAnimatedStep stepKey={step}>
            <OnboardingStepHeader
              eyebrow="Welcome to Listio"
              title="Plan meals, build your list, then shop"
              subtitle={`Three connected tabs keep your week, recipes, and grocery run in one place. Free plan: up to ${FREE_LIST_ITEMS_LIMIT} list items, ${FREE_MEALS_LIMIT} meal, and ${FREE_RECIPES_LIMIT} recipe.`}
            />
            <OnboardingWelcomeFeatured />
          </OnboardingAnimatedStep>
        ) : null}

        {step === ORIENTATION_STEP ? (
          <OnboardingAnimatedStep stepKey={step}>
            <OnboardingTabsOrientation />
          </OnboardingAnimatedStep>
        ) : null}

        {step === REMINDERS_STEP ? (
          <OnboardingAnimatedStep stepKey={step}>
            <OnboardingStepHeader
              eyebrow="Stay on track"
              title="Reminders that fit your rhythm"
              subtitle="We will nudge you before trips and a few days ahead so your list is ready when you shop."
            />
            <OnboardingShoppingRhythmFeatured
              syncEnabled={isSyncEnabled()}
              selectedDays={shoppingWeekdays}
              onChangeDays={setShoppingWeekdays}
              timeBucket={shoppingTimeBucket}
              onChangeBucket={setShoppingTimeBucket}
            />
          </OnboardingAnimatedStep>
        ) : null}

        {step === FINISH_STEP ? (
          <OnboardingAnimatedStep stepKey={step}>
            <OnboardingStagger index={0}>
              <OnboardingStepHeader
                eyebrow="Almost there"
                title="You are ready to go"
                subtitle="List is your home base. Jump to Meals and Recipes from the tab bar anytime."
              />
            </OnboardingStagger>
            <OnboardingFinishFeatured />
          </OnboardingAnimatedStep>
        ) : null}
      </ScrollView>

      <OnboardingBottomCta
        bottomInset={insets.bottom}
        label={ctaLabel}
        onPress={() => {
          void handleCta();
        }}
        loading={(finishBusy && step === FINISH_STEP) || (routineSaveBusy && step === REMINDERS_STEP)}
        disabled={(finishBusy && step === FINISH_STEP) || (routineSaveBusy && step === REMINDERS_STEP)}
        secondaryAction={secondaryAction}
        footer={step === FINISH_STEP ? legalFooter : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  accentGlow: {
    top: '35%',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
