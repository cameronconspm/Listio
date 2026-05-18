import { useEffect, useRef } from 'react';
import { Keyboard } from 'react-native';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

/** Gap (pt) between the quick bar and the tab bar / keyboard top. */
export const COMPOSER_KEYBOARD_EDGE_GAP = 6;

type UseKeyboardFrameLiftOptions = {
  tabBarHeight: number;
  restingBottomOffset?: number;
  edgeGap?: number;
  extraLift?: number;
  onKeyboardHidden?: () => void;
};

/**
 * Pure math used by tests and by callers that need a synchronous read of where the bar should
 * sit given the latest keyboard height.
 */
export function getStickyQuickBarBottomInset(
  keyboardHeight: number,
  tabBarHeight: number,
  edgeGap = COMPOSER_KEYBOARD_EDGE_GAP,
  extraLift = 0
): number {
  if (keyboardHeight > 0) {
    return keyboardHeight + edgeGap + extraLift;
  }
  return tabBarHeight + edgeGap + extraLift;
}

/**
 * Sticky quick bar: `bottom = keyboardHeight + 6` while the keyboard is up, `tabBarHeight + 6`
 * at rest.
 *
 * Driven by `react-native-keyboard-controller` so keyboard height is observed natively on every
 * `keyboardWillChangeFrame` callback and written to a Reanimated shared value on the UI thread.
 * This means the bar follows Apple's actual private spring curve frame-by-frame — including
 * during interactive (drag-down) dismissal — instead of approximating it with a JS-thread
 * `withTiming` against a cubic bezier (which can never see per-frame keyboard position and
 * always desyncs during interactive dismissal).
 *
 * Reanimated's own `useAnimatedKeyboard` is deprecated in v4 and the official guidance is to
 * use `react-native-keyboard-controller`; see <https://docs.swmansion.com/react-native-reanimated/docs/device/useAnimatedKeyboard/#migration-guide>.
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

  const { height: kbTranslateY } = useReanimatedKeyboardAnimation();

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
      requestAnimationFrame(() => onKeyboardHiddenRef.current?.());
    });
    return () => sub.remove();
  }, []);

  return useAnimatedStyle(() => {
    // `useReanimatedKeyboardAnimation().height` is negative (translateY-style); flip for absolute px.
    const kb = -kbTranslateY.value;
    const gap = edgeGapSV.value;
    const tabBar = tabBarHeightSV.value;
    const lift = extraLiftSV.value;
    const bottom = kb > 0.5 ? kb + gap + lift : tabBar + gap + lift;

    return {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom,
    };
  });
}
