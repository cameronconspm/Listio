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
import Animated, { FadeIn, FadeOut, ZoomIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../design/ThemeContext';
import { backdropTiming, motionMs } from '../../ui/motion/presets';
import { PrimaryButton } from '../ui/PrimaryButton';
import { Button } from '../ui/Button';
import { Mascot } from '../brand/Mascot';

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
        heroWrap: {
          alignSelf: 'stretch',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: theme.spacing.md,
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
  const badgeEntering = rm
    ? FadeIn.duration(240)
    : ZoomIn.springify().damping(13).stiffness(170).mass(0.9).delay(60);
  const backdropEntering = FadeIn.duration(backdropTiming(rm).duration ?? 220);
  const backdropExiting = FadeOut.duration(motionMs(180, rm));

  const itemWord = totalItems === 1 ? 'item' : 'items';
  const aisleWord = aisleCount === 1 ? 'aisle' : 'aisles';

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
        <Animated.View entering={backdropEntering} exiting={backdropExiting} style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={onKeep}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          />
        </Animated.View>
        <Animated.View entering={cardEntering} style={styles.card}>
          <View style={styles.heroWrap}>
            <Animated.View entering={badgeEntering}>
              <Mascot mood="celebrate" size={116} accessibilityLabel="Listio mascot celebrating" />
            </Animated.View>
          </View>
          <Text style={styles.title}>{"That's the whole list!"}</Text>
          <Text style={styles.statLine}>
            You grabbed {totalItems} {itemWord} across {aisleCount} {aisleWord}.
          </Text>
          <Text style={styles.detail}>
            Clear them for a fresh start, or keep them to remember what you picked up.
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
