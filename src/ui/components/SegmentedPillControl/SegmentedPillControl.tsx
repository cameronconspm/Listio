import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type WithTimingConfig,
} from 'react-native-reanimated';
import { GlassView } from '../../../components/ui/GlassView';
import { useTheme } from '../../../design/ThemeContext';
import { useHaptics } from '../../../hooks/useHaptics';
import { useReduceMotion } from '../../motion/useReduceMotion';
import { segmentPillTiming } from '../../motion/controls';
import { spacing } from '../../../design/spacing';
import { radius } from '../../../design/radius';

type Segment<T extends string> = { key: T; label: string };

export type SegmentedPillControlProps<T extends string> = {
  segments: Segment<T>[];
  value: T;
  onChange: (key: T) => void;
  /** Optional timing override (e.g. `listModeSwapTiming` for Plan/Shop sync). */
  pillTiming?: WithTimingConfig;
  /** Solid track skips BlurView for stable first paint (e.g. list-tab Plan/Shop). */
  variant?: 'glass' | 'solid';
  /** @deprecated Timing/spring pill slide removed — selection uses per-segment fill (instant, layout-stable). */
  preferTiming?: boolean;
};

const TRACK_INSET = spacing.xxs;
const SEGMENT_HEIGHT = 36;

function indexForValue<T extends string>(segments: Segment<T>[], key: T): number {
  const idx = segments.findIndex((seg) => seg.key === key);
  return idx >= 0 ? idx : 0;
}

/**
 * iOS-style segmented control: equal-width segments with a sliding selected pill.
 */
export function SegmentedPillControl<T extends string>({
  segments,
  value,
  onChange,
  variant = 'glass',
  pillTiming,
}: SegmentedPillControlProps<T>) {
  const theme = useTheme();
  const haptics = useHaptics();
  const reduceMotion = useReduceMotion();
  const [displayValue, setDisplayValue] = useState(value);
  const hasLaidOutRef = useRef(false);
  const pendingPressKeyRef = useRef<T | null>(null);

  const pillIndex = useSharedValue(indexForValue(segments, value));

  const slidePillToIndex = useCallback(
    (idx: number, animated: boolean) => {
      if (!animated || reduceMotion) {
        pillIndex.value = idx;
        return;
      }
      pillIndex.value = withTiming(
        idx,
        pillTiming ?? segmentPillTiming(reduceMotion, true)
      );
    },
    [pillIndex, pillTiming, reduceMotion]
  );

  useEffect(() => {
    if (pendingPressKeyRef.current === value) {
      pendingPressKeyRef.current = null;
      setDisplayValue(value);
      return;
    }
    pendingPressKeyRef.current = null;
    setDisplayValue(value);
    slidePillToIndex(indexForValue(segments, value), hasLaidOutRef.current);
  }, [value, segments, slidePillToIndex]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        glass: {
          padding: TRACK_INSET,
        },
        solidTrack: {
          padding: TRACK_INSET,
          borderRadius: radius.full,
          overflow: 'hidden',
          backgroundColor: theme.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.divider,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'stretch',
          height: SEGMENT_HEIGHT,
          position: 'relative',
        },
        pill: {
          position: 'absolute',
          top: 0,
          left: 0,
          height: SEGMENT_HEIGHT,
          borderRadius: radius.full,
          backgroundColor: theme.accent,
        },
        segment: {
          flex: 1,
          height: SEGMENT_HEIGHT,
          paddingHorizontal: spacing.md,
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
        },
        label: {
          ...theme.typography.subhead,
          fontWeight: '600',
        },
      }),
    [theme]
  );

  const pillStyle = useAnimatedStyle(() => {
    const count = Math.max(segments.length, 1);
    const segmentPct = 100 / count;
    return {
      width: `${segmentPct}%`,
      opacity: 1,
      transform: [{ translateX: `${pillIndex.value * 100}%` }],
    };
  }, [segments.length]);

  const handleRowLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    if (width <= 0 || hasLaidOutRef.current) return;
    hasLaidOutRef.current = true;
    pillIndex.value = indexForValue(segments, displayValue);
  };

  const handlePress = (key: T) => {
    if (key === displayValue) return;
    const idx = indexForValue(segments, key);
    pendingPressKeyRef.current = key;
    setDisplayValue(key);
    slidePillToIndex(idx, hasLaidOutRef.current);
    haptics.selection();
    onChange(key);
  };

  const body = (
    <View style={styles.row} onLayout={handleRowLayout} accessibilityRole="tablist">
      <Animated.View style={[styles.pill, pillStyle]} pointerEvents="none" />
      {segments.map((seg) => {
        const selected = seg.key === displayValue;
        return (
          <Pressable
            key={seg.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={styles.segment}
            onPress={() => handlePress(seg.key)}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                { color: selected ? theme.onAccent : theme.textSecondary },
              ]}
            >
              {seg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  if (variant === 'solid') {
    return <View style={styles.solidTrack}>{body}</View>;
  }

  return (
    <GlassView style={styles.glass} intensity={28} borderRadius={theme.radius.full}>
      {body}
    </GlassView>
  );
}
