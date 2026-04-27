import React, { useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/ThemeContext';
import { listDuration } from '../../ui/motion/lists';
import { ReorderSectionCard } from './ReorderSectionCard';
import type { ListItem, ZoneKey } from '../../types/models';
import type { ZoneIconOverrides } from '../../utils/storeUtils';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';

const WIGGLE_STEP_MS = 120;
const WIGGLE_DEG = 1.35;

type ReorderSectionRowProps = {
  zoneKey: ZoneKey;
  items: ListItem[];
  remaining: number;
  isShopMode: boolean;
  zoneIconOverrides: ZoneIconOverrides | null;
  reduceMotion: boolean;
  isActive: boolean;
  drag: () => void;
};

/**
 * One draggable section row: left handle, embedded summary card, gentle wiggle (iOS edit affordance).
 */
export function ReorderSectionRow({
  zoneKey,
  items,
  remaining,
  isShopMode,
  zoneIconOverrides,
  reduceMotion,
  isActive,
  drag,
}: ReorderSectionRowProps) {
  const theme = useTheme();
  const wiggleRot = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || isActive) {
      cancelAnimation(wiggleRot);
      wiggleRot.value = withTiming(0, { duration: listDuration.micro });
      return;
    }
    wiggleRot.value = withRepeat(
      withSequence(
        withTiming(-WIGGLE_DEG, { duration: WIGGLE_STEP_MS }),
        withTiming(WIGGLE_DEG, { duration: WIGGLE_STEP_MS })
      ),
      -1,
      true
    );
    return () => {
      cancelAnimation(wiggleRot);
    };
  }, [reduceMotion, isActive, wiggleRot]);

  const wiggleStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${wiggleRot.value}deg` }],
  }));

  return (
    <Animated.View style={[styles.rowOuter, wiggleStyle]}>
      <TouchableOpacity
        onLongPress={drag}
        disabled={isActive}
        activeOpacity={1}
        delayLongPress={280}
        accessibilityRole="adjustable"
        accessibilityLabel="Section, hold to drag to reorder"
        style={[
          styles.row,
          { backgroundColor: theme.surface, borderColor: theme.divider },
          isActive && { opacity: 0.92 },
        ]}
      >
        <View
          style={[
            styles.dragHandle,
            { backgroundColor: theme.textSecondary + '10', borderColor: theme.divider },
          ]}
        >
          <Ionicons name="reorder-three" size={22} color={theme.textSecondary} />
        </View>
        <View style={styles.cardWrap}>
          <ReorderSectionCard
            zoneKey={zoneKey}
            items={items}
            remaining={remaining}
            isShopMode={isShopMode}
            embedded
            zoneIconOverrides={zoneIconOverrides}
          />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  rowOuter: {
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dragHandle: {
    width: 52,
    minHeight: 64,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
  },
  cardWrap: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
});
