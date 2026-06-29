import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, ZoomIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../design/ThemeContext';
import { PrimaryButton } from '../ui/PrimaryButton';
import { Button } from '../ui/Button';
import { PressableScale } from '../ui/PressableScale';
import { Mascot } from '../brand/Mascot';
import { SubscriptionLegalLinks } from '../subscription/SubscriptionLegalLinks';
import type { ContextualPaywallReason } from '../../context/contextualPaywallReasons';
import { useReduceMotion } from '../../ui/motion/useReduceMotion';
import {
  LISTIO_PLUS_FEATURES,
  listioPaywallHeadline,
  listioPaywallRenewFinePrint,
  listioPaywallSubheadline,
  listioPaywallTrialCta,
  listioPaywallTrialDaysForPlan,
  listioPaywallTrialFootnote,
  listioPaywallTrialIncludesLabel,
  listioPaywallTrialShortLabel,
  MOCK_LISTIO_PAYWALL_PLANS,
  type ListioPaywallPlan,
  type ListioPaywallPlanId,
} from './listioPaywallContent';

type PaywallLayoutTier = 'regular' | 'compact' | 'tight';

function resolvePaywallLayoutTier(windowHeight: number): PaywallLayoutTier {
  if (windowHeight < 680) return 'tight';
  if (windowHeight < 780) return 'compact';
  return 'regular';
}

export type ListioPaywallSheetProps = {
  visible: boolean;
  /** Contextual trigger — adjusts headline and subcopy. */
  reason?: ContextualPaywallReason | null;
  plans?: ListioPaywallPlan[];
  /** Loading StoreKit / RevenueCat offerings. */
  plansLoading?: boolean;
  /** Pre-select annual for higher LTV; user can switch to monthly. */
  defaultPlanId?: ListioPaywallPlanId;
  onStartTrial: (planId: ListioPaywallPlanId) => void | Promise<void>;
  onRestore?: () => void | Promise<void>;
  onDismiss: () => void;
  busy?: boolean;
  restoreBusy?: boolean;
};

/**
 * Custom Listio+ paywall — value-first layout with a pinned CTA footer so the primary
 * action stays visible on small phones. Wire `onStartTrial` to `Purchases.purchasePackage()`.
 */
export function ListioPaywallSheet({
  visible,
  reason = null,
  plans = MOCK_LISTIO_PAYWALL_PLANS,
  plansLoading = false,
  defaultPlanId = 'annual',
  onStartTrial,
  onRestore,
  onDismiss,
  busy = false,
  restoreBusy = false,
}: ListioPaywallSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const layoutTier = resolvePaywallLayoutTier(windowHeight);
  const reduceMotion = useReduceMotion();
  const rm = useReducedMotion() || reduceMotion;
  const [selectedPlanId, setSelectedPlanId] = useState<ListioPaywallPlanId>(defaultPlanId);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? plans[0];
  const actionsDisabled = busy || restoreBusy;
  const selectedTrialDays = listioPaywallTrialDaysForPlan(selectedPlanId, selectedPlan);
  const headline = listioPaywallHeadline(reason);
  const subheadline = listioPaywallSubheadline(reason);
  const ctaLabel = listioPaywallTrialCta(selectedPlanId, selectedPlan);
  const trialFootnote = selectedPlan
    ? listioPaywallTrialFootnote(selectedPlan, selectedPlanId)
    : '';
  const trialPillLabel = listioPaywallTrialShortLabel(selectedTrialDays);
  const purchaseDisabled = actionsDisabled || plansLoading || plans.length === 0;

  const mascotSize = layoutTier === 'tight' ? 72 : layoutTier === 'compact' ? 84 : 96;
  const footerPadBottom = Math.max(insets.bottom, theme.spacing.sm);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          backgroundColor: theme.background,
        },
        closeRow: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          paddingHorizontal: theme.spacing.md,
          paddingTop: insets.top + (layoutTier === 'tight' ? 0 : theme.spacing.xs),
          paddingBottom: layoutTier === 'tight' ? 0 : theme.spacing.xs,
        },
        closeBtn: {
          width: 44,
          height: 44,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: theme.radius.full,
          backgroundColor: theme.surfaceGlass,
        },
        body: {
          flex: 1,
        },
        scroll: {
          flex: 1,
        },
        content: {
          paddingHorizontal: theme.spacing.lg,
          maxWidth: 420,
          alignSelf: 'center',
          width: '100%',
        },
        heroCard: {
          borderRadius: theme.radius.xl,
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.accent + '28',
          paddingHorizontal: theme.spacing.md,
          paddingTop: layoutTier === 'tight' ? theme.spacing.sm : theme.spacing.md,
          paddingBottom: layoutTier === 'tight' ? theme.spacing.sm : theme.spacing.md,
          marginBottom: layoutTier === 'tight' ? theme.spacing.sm : theme.spacing.md,
          ...theme.shadows.floating,
        },
        trialPill: {
          alignSelf: 'center',
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.xs,
          paddingHorizontal: theme.spacing.sm + 2,
          paddingVertical: 4,
          borderRadius: theme.radius.full,
          backgroundColor: theme.accent + '18',
          marginBottom: layoutTier === 'tight' ? theme.spacing.xs : theme.spacing.sm,
        },
        trialPillText: {
          ...theme.typography.caption2,
          color: theme.accent,
          fontWeight: '700',
          letterSpacing: 0.3,
        },
        mascotWrap: {
          alignItems: 'center',
          marginBottom: layoutTier === 'tight' ? theme.spacing.xs : theme.spacing.sm,
        },
        headline: {
          ...(layoutTier === 'tight' ? theme.typography.title3 : theme.typography.title2),
          color: theme.textPrimary,
          textAlign: 'center',
          marginBottom: theme.spacing.xs,
        },
        subheadline: {
          ...theme.typography.footnote,
          color: theme.textSecondary,
          textAlign: 'center',
          lineHeight: layoutTier === 'tight' ? 17 : 18,
        },
        features: {
          gap: layoutTier === 'tight' ? theme.spacing.xs : theme.spacing.sm,
          marginBottom: layoutTier === 'tight' ? theme.spacing.sm : theme.spacing.md,
        },
        featureRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: theme.spacing.sm,
        },
        featureIcon: {
          width: layoutTier === 'tight' ? 30 : 34,
          height: layoutTier === 'tight' ? 30 : 34,
          borderRadius: theme.radius.md,
          backgroundColor: theme.accent + '14',
          alignItems: 'center',
          justifyContent: 'center',
        },
        featureCopy: {
          flex: 1,
          paddingTop: 1,
        },
        featureTitle: {
          ...(layoutTier === 'tight' ? theme.typography.footnote : theme.typography.subhead),
          color: theme.textPrimary,
          fontWeight: '600',
        },
        featureSubtitle: {
          ...theme.typography.caption1,
          color: theme.textSecondary,
          lineHeight: layoutTier === 'tight' ? 15 : 16,
          marginTop: 1,
        },
        planSectionLabel: {
          ...theme.typography.caption2,
          color: theme.textSecondary,
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginBottom: theme.spacing.xs,
        },
        planCards: {
          gap: theme.spacing.xs,
          marginBottom: theme.spacing.sm,
        },
        planCard: {
          borderRadius: theme.radius.lg,
          borderWidth: 2,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: layoutTier === 'tight' ? theme.spacing.sm : theme.spacing.md,
          minHeight: layoutTier === 'tight' ? 60 : 64,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
        },
        planCardSelected: {
          borderColor: theme.accent,
          backgroundColor: theme.accent + '0c',
        },
        planCardUnselected: {
          borderColor: theme.divider,
          backgroundColor: theme.surface,
        },
        radio: {
          width: 20,
          height: 20,
          borderRadius: theme.radius.full,
          borderWidth: 2,
          alignItems: 'center',
          justifyContent: 'center',
        },
        radioInner: {
          width: 10,
          height: 10,
          borderRadius: theme.radius.full,
          backgroundColor: theme.accent,
        },
        planCopy: {
          flex: 1,
        },
        planTopRow: {
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: theme.spacing.xs,
        },
        planLabel: {
          ...(layoutTier === 'tight' ? theme.typography.subhead : theme.typography.headline),
          color: theme.textPrimary,
          fontWeight: '600',
        },
        planBadge: {
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: 2,
          borderRadius: theme.radius.full,
          backgroundColor: theme.accent,
        },
        planBadgeText: {
          ...theme.typography.caption2,
          color: theme.onAccent,
          fontWeight: '700',
        },
        planPrice: {
          ...theme.typography.caption1,
          color: theme.textSecondary,
          marginTop: 1,
        },
        planDetail: {
          ...theme.typography.caption2,
          color: theme.accent,
          fontWeight: '600',
          marginTop: 1,
        },
        scrollFooter: {
          gap: theme.spacing.sm,
          paddingTop: theme.spacing.xs,
        },
        secondaryActions: {
          gap: theme.spacing.xs,
          alignItems: 'center',
        },
        legalBlock: {
          alignItems: 'center',
          gap: theme.spacing.xs,
          paddingTop: theme.spacing.xs,
        },
        renewFinePrint: {
          ...theme.typography.caption2,
          color: theme.textSecondary,
          textAlign: 'center',
          lineHeight: 14,
          maxWidth: 340,
        },
        stickyFooter: {
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.sm,
          paddingBottom: footerPadBottom,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.divider,
          backgroundColor: theme.background,
          maxWidth: 420,
          alignSelf: 'center',
          width: '100%',
          gap: theme.spacing.xs,
        },
        trialFootnote: {
          ...theme.typography.caption2,
          color: theme.textSecondary,
          textAlign: 'center',
          lineHeight: 14,
        },
      }),
    [theme, insets.top, footerPadBottom, layoutTier]
  );

  const cardEntering = rm
    ? FadeIn.duration(220)
    : ZoomIn.springify().damping(17).stiffness(200).mass(0.85);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onDismiss}
      accessibilityViewIsModal
    >
      <View style={styles.root} accessibilityLabel="Listio+ upgrade">
        <View style={styles.closeRow}>
          <Pressable
            onPress={onDismiss}
            disabled={actionsDisabled}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={8}
          >
            <Ionicons name="close" size={22} color={theme.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.body}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View entering={cardEntering} style={styles.heroCard}>
              {trialPillLabel ? (
                <View style={styles.trialPill}>
                  <Ionicons name="gift-outline" size={13} color={theme.accent} />
                  <Text style={styles.trialPillText}>{trialPillLabel}</Text>
                </View>
              ) : null}
              <View style={styles.mascotWrap}>
                <Mascot
                  mood="celebrate"
                  size={mascotSize}
                  skipEntrance={rm}
                  accessibilityLabel="Listio mascot"
                />
              </View>
              <Text style={styles.headline}>{headline}</Text>
              <Text style={styles.subheadline}>{subheadline}</Text>
            </Animated.View>

            <View style={styles.features}>
              {LISTIO_PLUS_FEATURES.map((feature, i) => (
                <Animated.View
                  key={feature.title}
                  style={styles.featureRow}
                  entering={
                    rm
                      ? FadeIn.duration(160)
                      : FadeInDown.springify()
                          .damping(16)
                          .stiffness(200)
                          .delay(40 + i * 30)
                  }
                >
                  <View style={styles.featureIcon}>
                    <Ionicons
                      name={feature.icon}
                      size={layoutTier === 'tight' ? 15 : 17}
                      color={theme.accent}
                    />
                  </View>
                  <View style={styles.featureCopy}>
                    <Text style={styles.featureTitle}>{feature.title}</Text>
                    <Text style={styles.featureSubtitle}>{feature.subtitle}</Text>
                  </View>
                </Animated.View>
              ))}
            </View>

            <Text style={styles.planSectionLabel}>Choose your plan</Text>
            <View style={styles.planCards}>
              {plans.map((plan) => {
                const selected = plan.id === selectedPlanId;
              const planTrialLabel = listioPaywallTrialIncludesLabel(plan.id, plan);
              const planTrialDays = listioPaywallTrialDaysForPlan(plan.id, plan);
                return (
                  <PressableScale
                    key={plan.id}
                    onPress={() => setSelectedPlanId(plan.id)}
                    disabled={actionsDisabled}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${plan.label}, ${plan.priceLabel}`}
                    style={[
                      styles.planCard,
                      selected ? styles.planCardSelected : styles.planCardUnselected,
                    ]}
                  >
                    <View
                      style={[
                        styles.radio,
                        { borderColor: selected ? theme.accent : theme.divider },
                      ]}
                    >
                      {selected ? <View style={styles.radioInner} /> : null}
                    </View>
                    <View style={styles.planCopy}>
                      <View style={styles.planTopRow}>
                        <Text style={styles.planLabel}>{plan.label}</Text>
                        {plan.badge ? (
                          <View style={styles.planBadge}>
                            <Text style={styles.planBadgeText}>{plan.badge}</Text>
                          </View>
                        ) : null}
                      </View>
                      {planTrialDays > 0 ? (
                        <Text style={styles.planPrice}>{planTrialLabel}</Text>
                      ) : null}
                      <Text style={styles.planPrice}>
                        {planTrialDays > 0 ? `Then ${plan.priceLabel}` : plan.priceLabel}
                      </Text>
                      {plan.priceDetail ? (
                        <Text style={styles.planDetail}>{plan.priceDetail}</Text>
                      ) : null}
                    </View>
                  </PressableScale>
                );
              })}
            </View>

            <View style={styles.scrollFooter}>
              <View style={styles.secondaryActions}>
                {onRestore ? (
                  <Button
                    title="Restore purchases"
                    variant="tertiary"
                    onPress={() => void onRestore()}
                    disabled={actionsDisabled}
                    loading={restoreBusy}
                    style={{ minHeight: 44, alignSelf: 'stretch', borderRadius: theme.radius.full }}
                  />
                ) : null}
                <Button
                  title="Maybe later"
                  variant="secondary"
                  onPress={onDismiss}
                  disabled={actionsDisabled}
                  style={{ alignSelf: 'stretch', borderRadius: theme.radius.full }}
                />
              </View>

              {Platform.OS === 'ios' ? (
                <View style={styles.legalBlock}>
                  <SubscriptionLegalLinks compact />
              <Text style={styles.renewFinePrint}>
                {listioPaywallRenewFinePrint(selectedPlanId, selectedPlan)}
              </Text>
                </View>
              ) : null}
            </View>
          </ScrollView>

          <View style={styles.stickyFooter}>
            <PrimaryButton
              title={ctaLabel}
              onPress={() => void onStartTrial(selectedPlanId)}
              disabled={purchaseDisabled}
              loading={busy}
              flat
              style={{ alignSelf: 'stretch' }}
            />
            <Text style={styles.trialFootnote}>{trialFootnote}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}
