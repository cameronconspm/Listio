import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, ZoomIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../design/ThemeContext';
import { PrimaryButton } from '../ui/PrimaryButton';
import { Button } from '../ui/Button';
import {
  contextualPaywallBody,
  contextualPaywallHeadline,
  type ContextualPaywallReason,
} from '../../context/contextualPaywallReasons';
import { useReduceMotion } from '../../ui/motion/useReduceMotion';

const PAYWALL_ICONS = [
  'star-outline',
  'infinite-outline',
  'phone-portrait-outline',
  'cloud-outline',
  'rocket-outline',
] as const satisfies readonly (keyof typeof Ionicons.glyphMap)[];

type ContextualPaywallOverlayProps = {
  visible: boolean;
  reason: ContextualPaywallReason | null;
  onSeePlans: () => void | Promise<void>;
  onNotNow: () => void;
  onRestorePurchases?: () => void | Promise<void>;
  busy?: boolean;
  restoreBusy?: boolean;
};

/**
 * Full-screen Listio+ upsell styled like shop-run completion: animated icon row,
 * headline, body, and See plans / Not now actions.
 */
export function ContextualPaywallOverlay({
  visible,
  reason,
  onSeePlans,
  onNotNow,
  onRestorePurchases,
  busy = false,
  restoreBusy = false,
}: ContextualPaywallOverlayProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const rm = useReducedMotion() || reduceMotion;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: theme.spacing.lg,
          paddingTop: insets.top + theme.spacing.md,
          paddingBottom: insets.bottom + theme.spacing.lg,
        },
        backdrop: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: 'rgba(0,0,0,0.38)',
        },
        card: {
          width: Math.min(360, windowWidth - theme.spacing.lg * 2),
          borderRadius: theme.radius.xl,
          backgroundColor: theme.surface,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.lg + theme.spacing.xs,
          overflow: 'hidden' as const,
          ...theme.shadows.floating,
        },
        iconRow: {
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          alignSelf: 'stretch',
          flexWrap: 'nowrap' as const,
          gap: theme.spacing.sm,
          marginBottom: theme.spacing.md,
          overflow: 'hidden' as const,
        },
        iconCell: {
          width: 34,
          height: 34,
          alignItems: 'center',
          justifyContent: 'center',
        },
        title: {
          ...theme.typography.title2,
          color: theme.textPrimary,
          textAlign: 'center',
          marginBottom: theme.spacing.sm,
        },
        detail: {
          ...theme.typography.footnote,
          color: theme.textSecondary,
          textAlign: 'center',
          lineHeight: 20,
          marginBottom: theme.spacing.lg,
        },
        actions: {
          gap: theme.spacing.sm,
        },
      }),
    [theme, insets.top, insets.bottom, windowWidth]
  );

  const cardEntering = rm
    ? FadeIn.duration(220)
    : ZoomIn.springify().damping(17).stiffness(200).mass(0.85);

  if (!reason) return null;

  const actionsDisabled = busy || restoreBusy;
  const headline = contextualPaywallHeadline(reason);
  const body = contextualPaywallBody(reason);

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      statusBarTranslucent={Platform.OS === 'android'}
      onRequestClose={onNotNow}
      accessibilityViewIsModal
    >
      <View style={styles.root} accessibilityLabel="Listio+ upgrade">
        <Pressable
          style={styles.backdrop}
          onPress={onNotNow}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          disabled={actionsDisabled}
        />
        <Animated.View entering={cardEntering} style={styles.card}>
          <View style={styles.iconRow}>
            {PAYWALL_ICONS.map((iconName, i) => (
              <Animated.View
                key={iconName}
                style={styles.iconCell}
                entering={
                  rm
                    ? FadeIn.duration(160)
                    : FadeInDown.springify()
                        .damping(16)
                        .stiffness(200)
                        .delay(40 + i * 55)
                }
              >
                <Ionicons name={iconName} size={26} color={theme.accent} />
              </Animated.View>
            ))}
          </View>
          <Text style={styles.title}>{headline}</Text>
          <Text style={styles.detail}>{body}</Text>
          <View style={styles.actions}>
            <PrimaryButton
              title="See plans"
              onPress={() => void onSeePlans()}
              disabled={actionsDisabled}
              loading={busy}
              flat
              style={{ alignSelf: 'stretch' }}
            />
            {onRestorePurchases ? (
              <Button
                title="Restore purchases"
                variant="tertiary"
                onPress={() => void onRestorePurchases()}
                disabled={actionsDisabled}
                loading={restoreBusy}
                style={{ alignSelf: 'stretch', minHeight: 44, borderRadius: theme.radius.full }}
              />
            ) : null}
            <Button
              title="Not now"
              variant="secondary"
              onPress={onNotNow}
              disabled={actionsDisabled}
              style={{ alignSelf: 'stretch', borderRadius: theme.radius.full }}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
