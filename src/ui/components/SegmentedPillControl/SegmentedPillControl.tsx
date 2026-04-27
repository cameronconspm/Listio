import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { GlassView } from '../../../components/ui/GlassView';
import { useTheme } from '../../../design/ThemeContext';
import { useReduceMotion } from '../../motion/useReduceMotion';
import { segmentPillSpring, segmentPillTiming, segmentPressIn, segmentPressOut } from '../../motion/controls';
import { spacing } from '../../../design/spacing';
import { radius } from '../../../design/radius';

type Segment<T extends string> = { key: T; label: string };

export type SegmentedPillControlProps<T extends string> = {
  segments: Segment<T>[];
  value: T;
  onChange: (key: T) => void;
};

const PILL_INSET = 3;

/**
 * iOS-style segmented control: sliding pill with correct first-frame placement
 * (no spring from index 0 on mount) and animated transitions only after layout init.
 */
export function SegmentedPillControl<T extends string>({
  segments,
  value,
  onChange,
}: SegmentedPillControlProps<T>) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const segmentCount = segments.length;

  const rowW = useSharedValue(0);
  const indexSv = useSharedValue(0);
  const pressedSv = useSharedValue(0);
  const layoutReadyRef = useRef(false);
  const prevIndexRef = useRef<number | null>(null);
  const lastLayoutWRef = useRef(0);

  const selectedIndex = segments.findIndex((s) => s.key === value);
  const safeIndex = selectedIndex >= 0 ? selectedIndex : 0;

  const applyIndexImmediate = useCallback(
    (idx: number) => {
      indexSv.value = idx;
    },
    [indexSv]
  );

  const onRowLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const w = e.nativeEvent.layout.width;
      rowW.value = w;
      const firstLayout = !layoutReadyRef.current;
      const widthChanged = Math.abs(w - lastLayoutWRef.current) > 0.5;
      lastLayoutWRef.current = w;

      if (firstLayout) {
        applyIndexImmediate(safeIndex);
        layoutReadyRef.current = true;
        prevIndexRef.current = safeIndex;
        return;
      }
      if (widthChanged) {
        applyIndexImmediate(safeIndex);
        prevIndexRef.current = safeIndex;
      }
    },
    [rowW, safeIndex, applyIndexImmediate]
  );

  useEffect(() => {
    if (!layoutReadyRef.current) return;
    if (prevIndexRef.current === safeIndex) return;

    prevIndexRef.current = safeIndex;
    if (reduceMotion) {
      indexSv.value = withTiming(safeIndex, segmentPillTiming(true));
    } else {
      indexSv.value = withSpring(safeIndex, segmentPillSpring(false));
    }
  }, [safeIndex, indexSv, reduceMotion]);

  const pillStyle = useAnimatedStyle(() => {
    const w = rowW.value;
    const n = segmentCount;
    if (w < 8 || n < 1) return { opacity: 0 };
    const cell = w / n;
    const pillW = Math.max(0, cell - 2 * PILL_INSET);
    const left = indexSv.value * cell + PILL_INSET;
    return {
      opacity: 1,
      width: pillW,
      left,
    };
  });

  const rootStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - 0.012 * pressedSv.value }],
  }));

  return (
    <Animated.View style={rootStyle}>
      {/* Outer track uses the same capsule radius as the sliding pill (`styles.pill` → theme.radius.full). */}
      <GlassView style={styles.glass} intensity={28} borderRadius={theme.radius.full}>
        <View style={styles.track} onLayout={onRowLayout}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.pill,
              {
                backgroundColor: theme.accent,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 2,
                elevation: 2,
              },
              pillStyle,
            ]}
          />
          <View style={styles.row}>
            {segments.map((seg) => {
              const selected = seg.key === value;
              return (
                <Pressable
                  key={seg.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={styles.segment}
                  onPress={() => onChange(seg.key)}
                  onPressIn={() => {
                    pressedSv.value = withTiming(1, segmentPressIn(reduceMotion));
                  }}
                  onPressOut={() => {
                    pressedSv.value = withTiming(0, segmentPressOut(reduceMotion));
                  }}
                >
                  <Text
                    style={[
                      theme.typography.subhead,
                      {
                        color: selected ? theme.onAccent : theme.textSecondary,
                        fontWeight: selected ? '600' : '400',
                      },
                    ]}
                  >
                    {seg.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </GlassView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  glass: {
    padding: spacing.xxs,
  },
  track: {
    position: 'relative',
    minHeight: 36,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  segment: {
    flex: 1,
    minHeight: 36,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  pill: {
    position: 'absolute',
    top: PILL_INSET,
    bottom: PILL_INSET,
    borderRadius: radius.full,
    zIndex: 0,
  },
});
