import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../../design/ThemeContext';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';

type Props = {
  checked: number;
  total: number;
  reduceMotion?: boolean;
};

export function ShopProgressBar({ checked, total, reduceMotion = false }: Props) {
  const theme = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const fillWidth = useSharedValue(0);

  const progress = total > 0 ? Math.min(checked / total, 1) : 0;

  useEffect(() => {
    if (trackWidth <= 0) return;
    fillWidth.value = withTiming(progress * trackWidth, {
      duration: reduceMotion ? 0 : 450,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, trackWidth, fillWidth, reduceMotion]);

  const fillStyle = useAnimatedStyle(() => ({
    width: fillWidth.value,
  }));

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== trackWidth) {
      setTrackWidth(w);
      // Snap to current progress immediately on first layout (no animation)
      fillWidth.value = progress * w;
    }
  };

  if (total === 0) return null;

  const pct = Math.round(progress * 100);
  const isDone = checked >= total;

  return (
    <View style={styles.container} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: checked }}>
      <View
        style={[styles.track, { backgroundColor: theme.accent + '20' }]}
        onLayout={handleLayout}
      >
        <Animated.View
          style={[
            styles.fill,
            fillStyle,
            {
              backgroundColor: isDone ? theme.accent : theme.accent,
            },
          ]}
        />
      </View>
      <Text
        style={[
          theme.typography.caption1,
          styles.label,
          { color: isDone ? theme.accent : theme.textSecondary, fontWeight: isDone ? '600' : '400' },
        ]}
        accessibilityElementsHidden
      >
        {isDone ? 'All done!' : `${pct}%`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.full,
  },
  label: {
    width: 44,
    textAlign: 'right',
  },
});
