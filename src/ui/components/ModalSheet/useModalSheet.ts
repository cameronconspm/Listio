import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, type LayoutChangeEvent } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import {
  cancelAnimation,
  Extrapolation,
  interpolate,
  runOnJS,
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
  /** JS-thread mirror so the visibility effect can decide whether to suppress initial lift. */
  const keyboardLiftEnabledRef = useRef(1);
  /**
   * Keyboard height is tracked natively (UI-thread, frame-by-frame) by react-native-keyboard-controller.
   * `kbTranslateY` is the negative translateY-style height the library exposes; flip it to a
   * positive pixel value when we want the absolute amount of lift to apply.
   *
   * Replaces the previous deprecated `useAnimatedKeyboard` + fabricated `Easing.bezier(0.42, 0, 0.58, 1)`
   * approximation; the bar/sheet now follow Apple's actual private spring curve, including during
   * interactive (drag-down) keyboard dismissal.
   */
  const { height: kbTranslateY } = useReanimatedKeyboardAnimation();

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
   * Body kept on a ref so lift enable stays current. The library tracks `kbTranslateY` independently,
   * so no manual `Keyboard.metrics()` sync is needed — flipping the multiplier 0→1 immediately uses
   * the height the library has already been observing.
   */
  const enterCompleteWithKeyboardLiftWorkRef = useRef<() => void>(() => {});
  useEffect(() => {
    enterCompleteWithKeyboardLiftWorkRef.current = () => {
      keyboardLiftEnabledRef.current = 1;
      keyboardLiftEnabledSV.value = 1;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            emitPresented();
          });
        });
      });
    };
  }, [emitPresented, keyboardLiftEnabledSV]);

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
    /** Library exposes `height` as a negative translateY-style value; flip to a positive height. */
    const kbHeight = syncKeyboardLift ? -kbTranslateY.value : 0;
    const kb = kbHeight * keyboardLiftEnabledSV.value;
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

  useLayoutEffect(() => {
    const wasVisible = prevVisibleRef.current;
    prevVisibleRef.current = visible;

    if (visible) {
      setIsExiting(false);
      keyboardLiftEnabledRef.current = syncKeyboardLift ? 0 : 1;
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
