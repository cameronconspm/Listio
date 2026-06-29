import { useEffect, useRef } from 'react';
import { Keyboard } from 'react-native';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

/** Gap (pt) between the quick bar and the tab bar / keyboard top. */
export const COMPOSER_KEYBOARD_EDGE_GAP = 6;

/** Progress above this → pin the bar to live keyboard height (keyboard clearly open). */
const KEYBOARD_OPEN_PROGRESS = 0.5;

type UseKeyboardFrameLiftOptions = {
  tabBarHeight: number;
  restingBottomOffset?: number;
  edgeGap?: number;
  extraLift?: number;
  onKeyboardHidden?: () => void;
};

/**
 * Resolves sticky quick-bar `bottom` inset from keyboard height + progress.
 *
 * While the keyboard is open (`progress > 0.5`), the bar tracks keyboard height exactly.
 * While closing, `Math.max(keyboard, tabBar resting)` prevents a late snap when height
 * lingers near zero but the tab bar is returning — the common source of drift after many
 * open/close cycles with a hard `height > 0.5` threshold.
 */
export function resolveStickyQuickBarBottomInset(
  keyboardHeight: number,
  tabBarHeight: number,
  keyboardProgress: number,
  edgeGap = COMPOSER_KEYBOARD_EDGE_GAP,
  extraLift = 0
): number {
  'worklet';
  const kb = Math.max(0, keyboardHeight);
  const restingBottom = tabBarHeight + edgeGap + extraLift;
  const keyboardPinnedBottom = kb + edgeGap + extraLift;
  return keyboardProgress > KEYBOARD_OPEN_PROGRESS
    ? keyboardPinnedBottom
    : Math.max(keyboardPinnedBottom, restingBottom);
}

/**
 * @deprecated Prefer {@link resolveStickyQuickBarBottomInset} with explicit progress.
 * Assumes keyboard is fully open when height > 0 and fully closed when height is 0.
 */
export function getStickyQuickBarBottomInset(
  keyboardHeight: number,
  tabBarHeight: number,
  edgeGap = COMPOSER_KEYBOARD_EDGE_GAP,
  extraLift = 0
): number {
  const progress = keyboardHeight > 0 ? 1 : 0;
  return resolveStickyQuickBarBottomInset(
    keyboardHeight,
    tabBarHeight,
    progress,
    edgeGap,
    extraLift
  );
}

/**
 * Sticky quick bar: tracks keyboard height on the UI thread via `react-native-keyboard-controller`.
 */
export function useKeyboardFrameLift({
  tabBarHeight: tabBarHeightProp,
  restingBottomOffset,
  edgeGap = COMPOSER_KEYBOARD_EDGE_GAP,
  extraLift = 0,
  onKeyboardHidden,
}: UseKeyboardFrameLiftOptions) {
  const tabBarHeight =
    tabBarHeightProp ?? (restingBottomOffset != null ? restingBottomOffset - edgeGap : 0);

  const { height: kbTranslateY, progress } = useReanimatedKeyboardAnimation();

  const tabBarHeightSV = useSharedValue(tabBarHeight);
  const edgeGapSV = useSharedValue(edgeGap);
  const extraLiftSV = useSharedValue(extraLift);
  const onKeyboardHiddenRef = useRef(onKeyboardHidden);
  onKeyboardHiddenRef.current = onKeyboardHidden;

  useEffect(() => {
    tabBarHeightSV.value = tabBarHeight;
  }, [tabBarHeight, tabBarHeightSV]);

  useEffect(() => {
    edgeGapSV.value = edgeGap;
  }, [edgeGap, edgeGapSV]);

  useEffect(() => {
    extraLiftSV.value = extraLift;
  }, [extraLift, extraLiftSV]);

  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => {
      onKeyboardHiddenRef.current?.();
    });
    return () => sub.remove();
  }, []);

  return useAnimatedStyle(() => {
    const kb = Math.max(0, -kbTranslateY.value);
    const bottom = resolveStickyQuickBarBottomInset(
      kb,
      tabBarHeightSV.value,
      progress.value,
      edgeGapSV.value,
      extraLiftSV.value
    );

    return {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom,
    };
  });
}
