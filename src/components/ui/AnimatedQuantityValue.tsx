import React, { useEffect } from 'react';
import { type TextStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useReduceMotion } from '../../ui/motion/useReduceMotion';
import { listDuration } from '../../ui/motion/lists';

type AnimatedQuantityValueProps = {
  value: number | string;
  style?: TextStyle | TextStyle[];
};

/** Subtle scale pop when a quantity value changes (stepper / commit). */
export function AnimatedQuantityValue({ value, style }: AnimatedQuantityValueProps) {
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    scale.value = withSequence(
      withTiming(1.1, { duration: listDuration.micro }),
      withTiming(1, { duration: listDuration.rowState })
    );
  }, [value, reduceMotion, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return <Animated.Text style={[style, animStyle]}>{String(value)}</Animated.Text>;
}
