import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Share,
  useWindowDimensions,
  Platform,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../design/ThemeContext';
import { backdropTiming, motionMs } from '../../ui/motion/presets';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '../ui/PrimaryButton';
import { Button } from '../ui/Button';
import { Mascot } from '../brand/Mascot';

const APP_STORE_URL = 'https://apps.apple.com/app/id6761579550';

type ShopRunCompleteOverlayProps = {
  visible: boolean;
  totalItems: number;
  /** Distinct store sections that held at least one item for this run. */
  aisleCount: number;
  /** All-time completed shop runs (including this one). */
  runCount?: number;
  /** Consecutive weeks with ≥1 shop run. */
  streakWeeks?: number;
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
  runCount,
  streakWeeks,
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
        chipsRow: {
          flexDirection: 'row',
          justifyContent: 'center',
          gap: theme.spacing.sm,
          marginBottom: theme.spacing.md,
        },
        chip: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: theme.spacing.xs,
          borderRadius: theme.radius.full,
          backgroundColor: theme.accent + '1a',
          borderWidth: 1,
          borderColor: theme.accent + '40',
          gap: 4,
        },
        chipStreak: {
          backgroundColor: '#ff9500' + '1a',
          borderColor: '#ff9500' + '40',
        },
        chipText: {
          ...theme.typography.footnote,
          color: theme.accent,
          fontWeight: '600',
        },
        chipTextStreak: {
          color: '#ff9500',
        },
        actions: {
          gap: theme.spacing.sm,
        },
        shareRow: {
          flexDirection: 'row',
          justifyContent: 'center',
          marginTop: theme.spacing.xs,
        },
        shareBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
        },
        shareBtnText: {
          ...theme.typography.footnote,
          color: theme.textSecondary,
          fontWeight: '500',
        },
      }),
    [theme, insets.top, insets.bottom, windowWidth]
  );

  const cardEntering = rm
    ? FadeIn.duration(220)
    : FadeInDown.springify().damping(20).stiffness(180).mass(0.9);
  const backdropEntering = FadeIn.duration(backdropTiming(rm).duration ?? 220);
  const backdropExiting = FadeOut.duration(motionMs(180, rm));

  const itemWord = totalItems === 1 ? 'item' : 'items';
  const aisleWord = aisleCount === 1 ? 'aisle' : 'aisles';

  const runLabel =
    runCount === 1
      ? 'First run! 🎉'
      : runCount != null
        ? `Run #${runCount}`
        : null;
  const showStreak = (streakWeeks ?? 0) >= 2;

  const handleShare = () => {
    const lines: string[] = ['🛒 Knocked out a full grocery run!', ''];
    lines.push(`${totalItems} ${itemWord} across ${aisleCount} ${aisleWord}`);
    if (runCount != null) lines.push(runCount === 1 ? 'First run ever 🎉' : `Run #${runCount}`);
    if (showStreak) lines.push(`🔥 ${streakWeeks}-week streak`);
    lines.push('', `Track your grocery runs with Listio → ${APP_STORE_URL}`);
    void Share.share({ message: lines.join('\n') });
  };

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
            <Mascot
              mood="celebrate"
              size={116}
              skipEntrance
              accessibilityLabel="Listio mascot celebrating"
            />
          </View>
          <Text style={styles.title}>{"That's the whole list!"}</Text>
          {(runLabel || showStreak) ? (
            <View style={styles.chipsRow}>
              {runLabel ? (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{runLabel}</Text>
                </View>
              ) : null}
              {showStreak ? (
                <View style={[styles.chip, styles.chipStreak]}>
                  <Text style={[styles.chipText, styles.chipTextStreak]}>
                    {`🔥 ${streakWeeks}-week streak`}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
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
          <View style={styles.shareRow}>
            <Pressable
              style={styles.shareBtn}
              onPress={handleShare}
              accessibilityRole="button"
              accessibilityLabel="Share your run"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="share-outline" size={15} color={theme.textSecondary} />
              <Text style={styles.shareBtnText}>Share your run</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
