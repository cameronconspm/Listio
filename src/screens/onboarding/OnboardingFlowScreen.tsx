import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Platform, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../design/ThemeContext';
import { markOnboardingCompleted } from '../../services/onboardingService';
import { shouldEnforceIosSubscriptionGate } from '../../services/purchasesService';
import { SubscriptionLegalLinks } from '../../components/subscription/SubscriptionLegalLinks';
import { LISTIO_PLUS_ANNUAL_USD_LABEL, LISTIO_PLUS_MONTHLY_USD_LABEL } from '../../constants/subscription';
import {
  FREE_LIST_ITEMS_LIMIT,
  FREE_MEALS_LIMIT,
  FREE_RECIPES_LIMIT,
} from '../../services/freeTierLimits';
import { FREE_AI_TASTE_USES } from '../../services/aiFeatureTaste';
import { createOnboardingLayout, onboardingPageGradient } from './onboardingTokens';
import { OnboardingTopChrome } from '../../components/onboarding/OnboardingTopChrome';
import { OnboardingBottomCta } from '../../components/onboarding/OnboardingBottomCta';
import { OnboardingAnimatedStep } from '../../components/onboarding/OnboardingAnimatedStep';
import { OnboardingStepHeader } from '../../components/onboarding/OnboardingStepHeader';
import { OnboardingWelcomeFeatured } from '../../components/onboarding/OnboardingWelcomeFeatured';
import { OnboardingFinishFeatured } from '../../components/onboarding/OnboardingFinishFeatured';
import { OnboardingStarterList } from '../../components/onboarding/OnboardingStarterList';
import { OnboardingTabsOrientation } from '../../components/onboarding/OnboardingTabsOrientation';
import { OnboardingStagger } from '../../components/onboarding/OnboardingStagger';
import { useAuth } from '../../context/AuthContext';
import { insertListItems, type ListItemInsert } from '../../services/listService';
import { STARTER_GROCERIES } from '../../constants/starterGroceries';
import { normalize } from '../../utils/normalize';
import { logger } from '../../utils/logger';

const STEP_COUNT = 4;
const ORIENTATION_STEP = 1;
const STARTER_STEP = 2;
const FINISH_STEP = 3;

/** Runs after sign-in when Supabase is configured. */

type Props = {
  onFinished: () => void | Promise<void>;
};

export function OnboardingFlowScreen({ onFinished }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const [step, setStep] = useState(0);
  const [finishBusy, setFinishBusy] = useState(false);
  const [seedBusy, setSeedBusy] = useState(false);
  const [selectedStarters, setSelectedStarters] = useState<Set<string>>(new Set());
  const [legalTermsExpanded, setLegalTermsExpanded] = useState(false);

  const isDark = theme.colorScheme === 'dark';
  const gradientColors = isDark ? onboardingPageGradient.dark : onboardingPageGradient.light;
  const onboardingLayout = useMemo(
    () => createOnboardingLayout(theme.spacing, theme.layoutScale),
    [theme],
  );

  const toggleStarter = useCallback((name: string) => {
    setSelectedStarters((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const seedStarterItems = async (): Promise<void> => {
    if (selectedStarters.size === 0) return;
    if (typeof userId !== 'string' || !userId) return;
    const items: ListItemInsert[] = STARTER_GROCERIES.filter((g) =>
      selectedStarters.has(g.name)
    ).map((g) => ({
      user_id: userId,
      name: g.name,
      normalized_name: normalize(g.name),
      category: '',
      zone_key: g.zone_key,
      quantity_value: null,
      quantity_unit: null,
      notes: null,
      is_checked: false,
      linked_meal_ids: [],
    }));
    try {
      await insertListItems(userId, items);
    } catch (e) {
      // Non-fatal: never block onboarding if the seed write fails.
      logger.warn('onboarding: failed to seed starter list', {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const handleCta = async () => {
    if (step < STEP_COUNT - 1) {
      if (step === STARTER_STEP) {
        setSeedBusy(true);
        try {
          await seedStarterItems();
        } finally {
          setSeedBusy(false);
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
    step === FINISH_STEP
      ? 'Get started'
      : step === STARTER_STEP
        ? selectedStarters.size > 0
          ? 'Add to my list'
          : 'Next'
        : 'Continue';

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
          Free plan: up to {FREE_LIST_ITEMS_LIMIT} list items, {FREE_MEALS_LIMIT} meals, and {FREE_RECIPES_LIMIT} recipes,
          plus {FREE_AI_TASTE_USES} free Smart adds and recipe imports. Listio+ ({LISTIO_PLUS_MONTHLY_USD_LABEL} or{' '}
          {LISTIO_PLUS_ANNUAL_USD_LABEL}, auto-renewing) unlocks unlimited use, recipe imports, Smart add, and more.
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
      : step === STARTER_STEP
        ? {
            label: 'Skip for now',
            accessibilityLabel: 'Skip adding starter items. You can add your own later.',
            onPress: () => setStep(FINISH_STEP),
          }
        : {
            label: 'Skip',
            onPress: () => {
              if (step === 0) setStep(1);
              else if (step === ORIENTATION_STEP) setStep(STARTER_STEP);
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
              subtitle="Three connected tabs keep your week, recipes, and grocery run in one place — so you never copy the same items twice."
            />
            <OnboardingWelcomeFeatured />
          </OnboardingAnimatedStep>
        ) : null}

        {step === ORIENTATION_STEP ? (
          <OnboardingAnimatedStep stepKey={step}>
            <OnboardingTabsOrientation />
          </OnboardingAnimatedStep>
        ) : null}

        {step === STARTER_STEP ? (
          <OnboardingAnimatedStep stepKey={step}>
            <OnboardingStepHeader
              eyebrow="Your first list"
              title="Grab a few staples to start"
              subtitle="Tap what you need and we'll sort it by aisle. You can always add more later."
            />
            <OnboardingStarterList selected={selectedStarters} onToggle={toggleStarter} />
          </OnboardingAnimatedStep>
        ) : null}

        {step === FINISH_STEP ? (
          <OnboardingAnimatedStep stepKey={step}>
            <OnboardingStagger index={0}>
              <OnboardingStepHeader
                eyebrow="Almost there"
                title="You're all set"
                subtitle="List is home base. Meals and Recipes are always a tap away in the tab bar."
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
        loading={(finishBusy && step === FINISH_STEP) || (seedBusy && step === STARTER_STEP)}
        disabled={(finishBusy && step === FINISH_STEP) || (seedBusy && step === STARTER_STEP)}
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
