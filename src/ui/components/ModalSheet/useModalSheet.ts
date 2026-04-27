import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Keyboard,
  Platform,
  type KeyboardEvent,
  type KeyboardEventEasing,
  type LayoutChangeEvent,
} from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useReduceMotion } from '../../motion/useReduceMotion';
import {
  backdrop as backdropToken,
  distance,
  duration,
  easing,
  spring,
  threshold,
} from '../../motion/tokens';
import { modalEnterTiming, modalExitTiming, motionMs } from '../../motion/presets';
import type { UseModalSheetOptions, UseModalSheetResult } from './modalSheet.types';

const REDUCED = distance.reducedSheetTravel;

function mapKeyboardEasing(name: KeyboardEventEasing | undefined) {
  switch (name) {
    case 'easeIn':
      return Easing.in(Easing.ease);
    case 'easeOut':
      return Easing.out(Easing.ease);
    case 'easeInEaseOut':
      return Easing.inOut(Easing.ease);
    case 'linear':
      return Easing.linear;
    case 'keyboard':
    default:
      return Easing.bezier(0.42, 0, 0.58, 1);
  }
}

/** RN iOS keyboard events use seconds; guard if a future RN reports ms. */
function keyboardDurationMs(e: { duration?: number }): number {
  let d = e.duration;
  if (d == null || d === 0) {
    d = 0.25;
  }
  const ms = d > 10 ? Math.round(d) : Math.round(d * 1000);
  const clamped = Math.max(16, Math.min(ms, 5000));
  // keyboardWillChangeFrame often omits duration (0) → was clamping to 1ms and snapping
  return clamped < 50 ? 250 : clamped;
}

export function useModalSheet({
  visible,
  onClose,
  interactiveDismiss,
  syncKeyboardLift = false,
  onEnterAnimationStart,
  onPresented,
  onExitAnimationStart,
  onDismissed,
}: UseModalSheetOptions): UseModalSheetResult {
  const onDismissedRef = useRef(onDismissed);
  onDismissedRef.current = onDismissed;
  const onEnterAnimationStartRef = useRef(onEnterAnimationStart);
  onEnterAnimationStartRef.current = onEnterAnimationStart;
  const onExitAnimationStartRef = useRef(onExitAnimationStart);
  onExitAnimationStartRef.current = onExitAnimationStart;
  const onPresentedRef = useRef(onPresented);
  onPresentedRef.current = onPresented;

  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  /** When syncKeyboardLift: 0 during sheet slide-in; 1 after enter animation completes. */
  const keyboardLiftEnabledSV = useSharedValue(1);
  /** JS-thread mirror for Keyboard.metrics() sync on enter (cannot read SV on JS). */
  const keyboardLiftEnabledRef = useRef(1);
  /**
   * iOS: driven by Keyboard keyboardWillChangeFrame / keyboardWillHide with system duration+easing.
   * Android still uses useAnimatedKeyboard for the sheet transform.
   */
  const keyboardInsetIOS = useSharedValue(0);
  const keyboard = useAnimatedKeyboard();

  const emitEnterAnimationStart = useCallback(() => {
    onEnterAnimationStartRef.current?.();
  }, []);

  const emitExitAnimationStart = useCallback(() => {
    onExitAnimationStartRef.current?.();
  }, []);

  const emitPresented = useCallback(() => {
    if (visibleRef.current) {
      onPresentedRef.current?.();
    }
  }, []);

  /**
   * Stable identity for runOnJS (avoids Hermes/Reanimated stale runOnJS symbol after renames).
   * Body kept on a ref so lift enable + Keyboard.metrics() sync stay current.
   */
  const enterCompleteWithKeyboardLiftWorkRef = useRef<() => void>(() => {});
  useEffect(() => {
    enterCompleteWithKeyboardLiftWorkRef.current = () => {
      keyboardLiftEnabledRef.current = 1;
      const m = Keyboard.metrics();
      if (m && m.height > 0) {
        cancelAnimation(keyboardInsetIOS);
        keyboardInsetIOS.value = m.height;
      }
      keyboardLiftEnabledSV.value = 1;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            emitPresented();
          });
        });
      });
    };
  }, [emitPresented, keyboardInsetIOS, keyboardLiftEnabledSV]);

  const runEnterCompleteWithKeyboardLiftStable = useCallback(() => {
    enterCompleteWithKeyboardLiftWorkRef.current();
  }, []);

  const reduceMotion = useReduceMotion();
  const reduceMotionSV = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    reduceMotionSV.value = reduceMotion ? 1 : 0;
  }, [reduceMotion, reduceMotionSV]);

  const { height: windowHeight } = Dimensions.get('window');
  const windowH = useSharedValue(windowHeight);
  const measuredHeightRef = useRef(0);
  /** True until first layout after open schedules the enter animation (avoids animating full-window travel before measure). */
  const pendingEnterRef = useRef(false);
  const enterLayoutGenerationRef = useRef(0);
  const enterRafOuterRef = useRef<number | null>(null);

  const sheetHeightSV = useSharedValue(0);
  /** Frozen at measured enter height so backdrop dim range does not jump when layout height changes mid-presentation. */
  const backdropDimTravelSV = useSharedValue(0);
  const translateY = useSharedValue(windowHeight);
  const startY = useSharedValue(0);

  const [isExiting, setIsExiting] = useState(false);
  const prevVisibleRef = useRef(visible);
  const finishExit = useCallback(() => {
    setIsExiting(false);
    onDismissedRef.current?.();
  }, []);

  const travelPx = useCallback(() => {
    if (reduceMotion) return REDUCED;
    return measuredHeightRef.current > 0 ? measuredHeightRef.current : windowHeight;
  }, [reduceMotion, windowHeight]);

  const backdropOpacity = useDerivedValue(() => {
    const frozen = backdropDimTravelSV.value;
    const t = reduceMotionSV.value
      ? REDUCED
      : frozen > 1
        ? frozen
        : sheetHeightSV.value > 1
          ? sheetHeightSV.value
          : windowH.value;
    const travel = Math.max(t, 1);
    return interpolate(
      translateY.value,
      [0, travel],
      [backdropToken.dim, 0],
      Extrapolation.CLAMP
    );
  });

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sheetAnimatedStyle = useAnimatedStyle(() => {
    const kbRaw =
      syncKeyboardLift && Platform.OS === 'ios'
        ? keyboardInsetIOS.value
        : syncKeyboardLift
          ? keyboard.height.value
          : 0;
    const kb = kbRaw * keyboardLiftEnabledSV.value;
    return {
      transform: [{ translateY: translateY.value - kb }],
    };
  });

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      windowH.value = window.height;
    });
    return () => sub.remove();
  }, [windowH]);

  useEffect(() => {
    if (!syncKeyboardLift || Platform.OS !== 'ios') return;

    const applyFrame = (e: KeyboardEvent) => {
      // Always update keyboardInsetIOS while the modal is visible. Lift is gated in the worklet via
      // keyboardLiftEnabledSV so the sheet does not jump during slide-in; skipping here dropped
      // frames that fired before enter completed (logs showed skip with h=75 while liftEnabled=0).
      if (!visibleRef.current) {
        return;
      }
      const h = e.endCoordinates.height;
      const durationMs = keyboardDurationMs(e);
      keyboardInsetIOS.value = withTiming(h, {
        duration: durationMs,
        easing: mapKeyboardEasing(e.easing),
      });
    };

    const onWillHide = (e: KeyboardEvent) => {
      if (!visibleRef.current) return;
      const durationMs = keyboardDurationMs(e);
      keyboardInsetIOS.value = withTiming(0, {
        duration: durationMs,
        easing: mapKeyboardEasing(e.easing),
      });
    };

    const subFrame = Keyboard.addListener('keyboardWillChangeFrame', applyFrame);
    const subHide = Keyboard.addListener('keyboardWillHide', onWillHide);
    return () => {
      subFrame.remove();
      subHide.remove();
    };
  }, [syncKeyboardLift, keyboardInsetIOS]);

  useLayoutEffect(() => {
    const wasVisible = prevVisibleRef.current;
    prevVisibleRef.current = visible;

    if (visible) {
      setIsExiting(false);
      keyboardLiftEnabledRef.current = syncKeyboardLift ? 0 : 1;
      keyboardInsetIOS.value = 0;
      if (syncKeyboardLift) {
        keyboardLiftEnabledSV.value = 0;
      }
      measuredHeightRef.current = 0;
      sheetHeightSV.value = 0;
      backdropDimTravelSV.value = 0;
      pendingEnterRef.current = true;
      if (enterRafOuterRef.current != null) {
        cancelAnimationFrame(enterRafOuterRef.current);
        enterRafOuterRef.current = null;
      }
      const tPrepare = reduceMotion ? REDUCED : windowHeight;
      cancelAnimation(translateY);
      translateY.value = tPrepare;
    } else if (wasVisible) {
      pendingEnterRef.current = false;
      keyboardLiftEnabledRef.current = 1;
      keyboardInsetIOS.value = 0;
      if (syncKeyboardLift) {
        keyboardLiftEnabledSV.value = 1;
      }
      if (enterRafOuterRef.current != null) {
        cancelAnimationFrame(enterRafOuterRef.current);
        enterRafOuterRef.current = null;
      }
      setIsExiting(true);
      const t = travelPx();
      cancelAnimation(translateY);
      emitExitAnimationStart();
      translateY.value = withTiming(t, modalExitTiming(reduceMotion), (finished) => {
        if (finished) runOnJS(finishExit)();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- translateY is a Reanimated shared value
  }, [
    visible,
    reduceMotion,
    travelPx,
    finishExit,
    emitExitAnimationStart,
    windowHeight,
    sheetHeightSV,
    backdropDimTravelSV,
    translateY,
    syncKeyboardLift,
    keyboardLiftEnabledSV,
  ]);

  const dismissFromGesture = useCallback(() => {
    onClose();
  }, [onClose]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(interactiveDismiss)
        .onBegin(() => {
          cancelAnimation(translateY);
          startY.value = translateY.value;
        })
        .onUpdate((e) => {
          const dy = Math.max(0, e.translationY);
          const t = reduceMotionSV.value
            ? REDUCED
            : sheetHeightSV.value > 1
              ? sheetHeightSV.value
              : windowH.value;
          const maxDown = t * 1.08;
          translateY.value = Math.min(startY.value + dy, startY.value + maxDown);
        })
        .onEnd((e) => {
          const t = reduceMotionSV.value
            ? REDUCED
            : sheetHeightSV.value > 1
              ? sheetHeightSV.value
              : windowH.value;
          const thresh = Math.max(
            threshold.sheetDismissMinDrag,
            t * threshold.sheetDismissProgress
          );
          const shouldDismiss =
            translateY.value > thresh || e.velocityY > threshold.sheetDismissVelocity;

          if (shouldDismiss) {
            runOnJS(dismissFromGesture)();
          } else if (reduceMotionSV.value) {
            translateY.value = withTiming(0, {
              duration: motionMs(duration.fast, true),
              easing: easing.easeOut,
            });
          } else {
            translateY.value = withSpring(0, {
              ...spring.sheetReturn,
              velocity: e.velocityY,
            });
          }
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gesture worklets close over stable Reanimated shared values
    [dismissFromGesture, interactiveDismiss]
  );

  const onSheetLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      measuredHeightRef.current = h;
      sheetHeightSV.value = h;

      if (!pendingEnterRef.current || !visibleRef.current || h < 1) {
        return;
      }

      enterLayoutGenerationRef.current += 1;
      const gen = enterLayoutGenerationRef.current;

      if (enterRafOuterRef.current != null) {
        cancelAnimationFrame(enterRafOuterRef.current);
        enterRafOuterRef.current = null;
      }

      enterRafOuterRef.current = requestAnimationFrame(() => {
        enterRafOuterRef.current = requestAnimationFrame(() => {
          enterRafOuterRef.current = null;
          if (!pendingEnterRef.current || !visibleRef.current) return;
          if (gen !== enterLayoutGenerationRef.current) return;
          const hFinal = measuredHeightRef.current;
          pendingEnterRef.current = false;
          cancelAnimation(translateY);
          translateY.value = hFinal;
          backdropDimTravelSV.value = hFinal;
          emitEnterAnimationStart();
          translateY.value = withTiming(0, modalEnterTiming(reduceMotion), (finished) => {
            if (finished) {
              if (syncKeyboardLift) {
                runOnJS(runEnterCompleteWithKeyboardLiftStable)();
              } else {
                runOnJS(emitPresented)();
              }
            }
          });
        });
      });
    },
    [
      sheetHeightSV,
      translateY,
      reduceMotion,
      emitPresented,
      emitEnterAnimationStart,
      runEnterCompleteWithKeyboardLiftStable,
      syncKeyboardLift,
      backdropDimTravelSV,
    ]
  );

  const showModal = visible || isExiting;

  return {
    showModal,
    backdropAnimatedStyle,
    sheetAnimatedStyle,
    panGesture,
    onSheetLayout,
  };
}
