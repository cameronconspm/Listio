import { useEffect } from 'react';
import { Keyboard, Platform } from 'react-native';
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type UseKeyboardFrameLiftOptions = {
  restingBottomOffset: number;
  extraLift?: number;
  onKeyboardHidden?: () => void;
};

function keyboardDurationMs(duration?: number): number {
  if (duration == null || duration === 0) return 250;
  return duration > 10 ? Math.round(duration) : Math.round(duration * 1000);
}

export function getKeyboardFrameLiftTarget(
  keyboardHeight: number,
  restingBottomOffset: number,
  extraLift = 0
): number {
  return Math.max(0, keyboardHeight - restingBottomOffset + extraLift);
}

export function useKeyboardFrameLift({
  restingBottomOffset,
  extraLift = 0,
  onKeyboardHidden,
}: UseKeyboardFrameLiftOptions) {
  const keyboardLift = useSharedValue(0);

  const liftedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -keyboardLift.value }],
  }));

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (event) => {
      const keyboardHeight = event.endCoordinates?.height ?? 0;
      keyboardLift.value = withTiming(
        getKeyboardFrameLiftTarget(keyboardHeight, restingBottomOffset, extraLift),
        {
          duration: keyboardDurationMs(event.duration),
          easing: Easing.out(Easing.cubic),
        }
      );
    });
    const hide = Keyboard.addListener(hideEvent, (event) => {
      keyboardLift.value = withTiming(0, {
        duration: keyboardDurationMs(event.duration),
        easing: Easing.out(Easing.cubic),
      });
      onKeyboardHidden?.();
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [extraLift, keyboardLift, onKeyboardHidden, restingBottomOffset]);

  return liftedStyle;
}
