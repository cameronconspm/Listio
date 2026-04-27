import React, { useEffect, useMemo } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useReduceMotion } from '../../motion/useReduceMotion';
import { distance } from '../../motion/tokens';
import { pressInTiming, pressOutTiming } from '../../motion/presets';

type PressableScaleProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  pressedOpacity?: number;
  pressedScale?: number;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * iOS-like press feedback: quick scale down, slightly slower return (no mush).
 */
export function PressableScale({
  style,
  pressedOpacity = 0.92,
  pressedScale = distance.pressScaleDown,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const reduceMotion = useReduceMotion();
  const pressInCfg = useMemo(() => pressInTiming(reduceMotion), [reduceMotion]);
  const pressOutCfg = useMemo(() => pressOutTiming(reduceMotion), [reduceMotion]);

  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (disabled) {
      scale.value = 1;
      opacity.value = 1;
    }
  }, [disabled]); // eslint-disable-line react-hooks/exhaustive-deps -- shared values

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={(e) => {
        if (!disabled) {
          scale.value = withTiming(reduceMotion ? 1 : pressedScale, pressInCfg);
          opacity.value = withTiming(pressedOpacity, pressInCfg);
        }
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!disabled) {
          scale.value = withTiming(1, pressOutCfg);
          opacity.value = withTiming(1, pressOutCfg);
        }
        onPressOut?.(e);
      }}
      {...rest}
      style={[style, animStyle]}
    />
  );
}
