import { useEffect } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useReduceMotion } from '../ui/motion/useReduceMotion';

/** Scroll Y at/below this → FAB fully expanded at rest; above → settles toward + only. */
export const FAB_SCROLL_EXPAND_END_PX = 88;
/** If |velocity.y| below this at drag end, treat as “no fling” and settle immediately (iOS pt/s scale). */
export const FAB_DRAG_END_VELOCITY_EPS = 0.28;
const FAB_COLLAPSE_MS = 150;
const FAB_COLLAPSE_MS_RM = 72;
const FAB_SETTLE_MS_RM = 200;
const FAB_SETTLE_SPRING = {
  damping: 22,
  stiffness: 340,
  mass: 0.78,
  overshootClamping: true,
} as const;

/** Space reserved above tab bar so list clears FAB + touch margin (FAB height 56). */
export const FAB_CLEARANCE = 56 + 20;

/**
 * Drives tab-root scroll offset + FAB expand/collapse (collapse while scrolling, spring settle when idle).
 * Pass the same SharedValue the tab chrome uses (e.g. scrollY.ListTab).
 */
export function useFabExpandScrollHandler(listScrollShared: SharedValue<number>) {
  const reduceMotion = useReduceMotion();
  const fabExpandProgress = useSharedValue(1);
  const reduceMotionSV = useSharedValue(0);

  useEffect(() => {
    reduceMotionSV.value = reduceMotion ? 1 : 0;
  }, [reduceMotion, reduceMotionSV]);

  const listScrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      listScrollShared.value = Math.max(0, e.contentOffset.y);
    },
    onBeginDrag: () => {
      cancelAnimation(fabExpandProgress);
      if (reduceMotionSV.value) {
        fabExpandProgress.value = withTiming(0, {
          duration: FAB_COLLAPSE_MS_RM,
          easing: Easing.out(Easing.quad),
        });
      } else {
        fabExpandProgress.value = withTiming(0, {
          duration: FAB_COLLAPSE_MS,
          easing: Easing.out(Easing.cubic),
        });
      }
    },
    onEndDrag: (e) => {
      listScrollShared.value = Math.max(0, e.contentOffset.y);
      const vel = (e as { velocity?: { y?: number } }).velocity;
      const vy = typeof vel?.y === 'number' ? vel.y : null;
      if (vy === null || Math.abs(vy) >= FAB_DRAG_END_VELOCITY_EPS) {
        return;
      }
      cancelAnimation(fabExpandProgress);
      const y = listScrollShared.value;
      const target = interpolate(
        y,
        [0, FAB_SCROLL_EXPAND_END_PX],
        [1, 0],
        Extrapolation.CLAMP
      );
      if (reduceMotionSV.value) {
        fabExpandProgress.value = withTiming(target, {
          duration: FAB_SETTLE_MS_RM,
          easing: Easing.out(Easing.cubic),
        });
      } else {
        fabExpandProgress.value = withSpring(target, { ...FAB_SETTLE_SPRING });
      }
    },
    onMomentumBegin: () => {
      cancelAnimation(fabExpandProgress);
      if (reduceMotionSV.value) {
        fabExpandProgress.value = withTiming(0, {
          duration: FAB_COLLAPSE_MS_RM,
          easing: Easing.out(Easing.quad),
        });
      } else {
        fabExpandProgress.value = withTiming(0, {
          duration: FAB_COLLAPSE_MS,
          easing: Easing.out(Easing.cubic),
        });
      }
    },
    onMomentumEnd: (e) => {
      listScrollShared.value = Math.max(0, e.contentOffset.y);
      cancelAnimation(fabExpandProgress);
      const y = listScrollShared.value;
      const target = interpolate(
        y,
        [0, FAB_SCROLL_EXPAND_END_PX],
        [1, 0],
        Extrapolation.CLAMP
      );
      if (reduceMotionSV.value) {
        fabExpandProgress.value = withTiming(target, {
          duration: FAB_SETTLE_MS_RM,
          easing: Easing.out(Easing.cubic),
        });
      } else {
        fabExpandProgress.value = withSpring(target, { ...FAB_SETTLE_SPRING });
      }
    },
  });

  return { fabExpandProgress, listScrollHandler };
}
