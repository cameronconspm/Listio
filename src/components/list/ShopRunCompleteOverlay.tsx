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

const CELEBRATION_ICONS = [
  'cart-outline',
  'sparkles',
  'color-wand-outline',
  'checkmark-circle',
  'nutrition-outline',
] as const satisfies readonly (keyof typeof Ionicons.glyphMap)[];

type ShopRunCompleteOverlayProps = {
  visible: boolean;
  totalItems: number;
  /** Distinct store sections that held at least one item for this run. */
  aisleCount: number;
  onKeep: () => void;
  onClearChecked: () => void | Promise<void>;
  clearing?: boolean;
  /** App-level reduce motion (accessibility). */
  reduceMotion: boolean;
};

/**
 * Shop-mode celebration when every list item is checked: quick stats plus
 * clear-checked vs keep choices.
 */
export function ShopRunCompleteOverlay({
  visible,
  totalItems,
  aisleCount,
  onKeep,
  onClearChecked,
  clearing = false,
  reduceMotion,
}: ShopRunCompleteOverlayProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
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
        sparkleRow: {
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          alignSelf: 'stretch',
          flexWrap: 'nowrap' as const,
          gap: theme.spacing.sm,
          marginBottom: theme.spacing.md,
          overflow: 'hidden' as const,
        },
        sparkleCell: {
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
        statLine: {
          ...theme.typography.body,
          color: theme.textPrimary,
          textAlign: 'center',
          fontWeight: '600',
          marginBottom: theme.spacing.xs,
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

  const itemWord = totalItems === 1 ? 'item' : 'items';
  const sectionWord = aisleCount === 1 ? 'section' : 'sections';

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      statusBarTranslucent={Platform.OS === 'android'}
      onRequestClose={onKeep}
      accessibilityViewIsModal
    >
      <View style={styles.root} accessibilityLabel="Shopping run complete">
        <Pressable style={styles.backdrop} onPress={onKeep} accessibilityRole="button" accessibilityLabel="Dismiss" />
        <Animated.View entering={cardEntering} style={styles.card}>
          <View style={styles.sparkleRow}>
            {CELEBRATION_ICONS.map((iconName, i) => (
              <Animated.View
                key={iconName}
                style={styles.sparkleCell}
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
          <Text style={styles.title}>Run complete!</Text>
          <Text style={styles.statLine}>
            You checked off {totalItems} {itemWord} across {aisleCount} store {sectionWord}.
          </Text>
          <Text style={styles.detail}>
            Clear checked items for a fresh list, or keep them here to remember what you picked up.
          </Text>
          <View style={styles.actions}>
            <PrimaryButton
              title="Clear checked items"
              onPress={() => void onClearChecked()}
              disabled={clearing}
              loading={clearing}
              flat
              style={{ alignSelf: 'stretch' }}
            />
            <Button
              title="Keep on list"
              variant="secondary"
              onPress={onKeep}
              disabled={clearing}
              style={{ alignSelf: 'stretch', borderRadius: theme.radius.full }}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
