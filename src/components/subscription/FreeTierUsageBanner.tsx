import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/ThemeContext';
import type { FreeTierKind } from '../../services/freeTierLimits';
import { freeTierUsageBannerText, freeTierUsageSummary } from '../../services/freeTierLimits';
import { shouldEnforceIosSubscriptionGate } from '../../services/purchasesService';
import { usePremiumEntitlement } from '../../context/PremiumEntitlementContext';

type FreeTierUsageBannerProps = {
  kind: FreeTierKind;
  currentCount: number;
  onPressUpgrade?: () => void;
};

/**
 * Slim usage indicator for free-tier caps. Hidden for Listio+ and when the gate is off.
 */
export function FreeTierUsageBanner({ kind, currentCount, onPressUpgrade }: FreeTierUsageBannerProps) {
  const theme = useTheme();
  const { isPremium, isPremiumLoading } = usePremiumEntitlement();

  const summary = useMemo(() => freeTierUsageSummary(kind, currentCount), [kind, currentCount]);
  const label = useMemo(() => freeTierUsageBannerText(summary), [summary]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          marginHorizontal: theme.spacing.md,
          marginBottom: theme.spacing.sm,
        },
        row: {
          minHeight: 44,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          borderRadius: theme.radius.full,
          borderWidth: StyleSheet.hairlineWidth,
          gap: theme.spacing.sm,
        },
        text: {
          flex: 1,
          ...theme.typography.footnote,
          lineHeight: 18,
        },
      }),
    [theme]
  );

  if (!shouldEnforceIosSubscriptionGate() || isPremium || isPremiumLoading) {
    return null;
  }

  // Generous free caps mean a usage banner from item one reads as pure scarcity.
  // Only surface it once the user is actually approaching or at the cap.
  if (!summary.nearLimit && !summary.atLimit) {
    return null;
  }

  const borderColor = summary.nearLimit || summary.atLimit ? theme.accent + '55' : theme.divider;
  const textColor = summary.nearLimit || summary.atLimit ? theme.accent : theme.textSecondary;
  const backgroundColor = summary.nearLimit || summary.atLimit ? theme.accent + '10' : theme.surface;

  const content = (
    <>
      <Ionicons
        name={summary.atLimit ? 'lock-closed-outline' : 'information-circle-outline'}
        size={18}
        color={textColor}
      />
      <Text style={[styles.text, { color: textColor }]} numberOfLines={2}>
        {label}
      </Text>
      {onPressUpgrade ? (
        <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
      ) : null}
    </>
  );

  if (onPressUpgrade) {
    return (
      <View style={styles.wrap}>
        <Pressable
          onPress={onPressUpgrade}
          accessibilityRole="button"
          accessibilityLabel={`${label}. View Listio plus plans`}
          style={({ pressed }) => [
            styles.row,
            {
              backgroundColor,
              borderColor,
              opacity: pressed ? 0.88 : 1,
            },
          ]}
        >
          {content}
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={[styles.row, { backgroundColor, borderColor }]}>{content}</View>
    </View>
  );
}
