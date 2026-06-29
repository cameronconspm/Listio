import { Easing, type WithTimingConfig } from 'react-native-reanimated';
import { easing, spring } from './tokens';
import { motionMs } from './presets';

/**
 * Shared beat for Plan/Shop pill slide + list content crossfade.
 * Pill runs full duration; content dips at midpoint (two equal halves).
 */
export const listModeSwapMotion = {
  durationMs: 128,
  contentFadeMin: 0.93,
} as const;

const listModeSwapEasing = Easing.bezier(0.33, 1, 0.68, 1);

export function listModeSwapTiming(reduceMotion: boolean): WithTimingConfig {
  return {
    duration: motionMs(listModeSwapMotion.durationMs, reduceMotion),
    easing: listModeSwapEasing,
  };
}

export function listModeSwapHalfTiming(reduceMotion: boolean): WithTimingConfig {
  return {
    duration: motionMs(listModeSwapMotion.durationMs / 2, reduceMotion),
    easing: Easing.inOut(Easing.cubic),
  };
}

/** Segmented pill / iOS-style segment motion */
export const segmentMotion = {
  pillShiftMs: 160,
  pillShiftSnappyMs: listModeSwapMotion.durationMs,
  pressScale: 0.988,
  pressInMs: 88,
  pressOutMs: 130,
} as const;

export function segmentPillTiming(reduceMotion: boolean, snappy = false): WithTimingConfig {
  return {
    duration: motionMs(snappy ? segmentMotion.pillShiftSnappyMs : segmentMotion.pillShiftMs, reduceMotion),
    easing: Easing.out(Easing.cubic),
  };
}

/** Restrained spring for pill slide — overshoot clamped */
export function segmentPillSpring(reduceMotion: boolean) {
  if (reduceMotion) {
    return {
      damping: 32,
      stiffness: 320,
      mass: 0.85,
      overshootClamping: true,
    } as const;
  }
  return {
    damping: 26,
    stiffness: 260,
    mass: 0.9,
    overshootClamping: true,
  } as const;
}

export function segmentPressIn(reduceMotion: boolean): WithTimingConfig {
  return {
    duration: motionMs(segmentMotion.pressInMs, reduceMotion),
    easing: easing.easeOut,
  };
}

export function segmentPressOut(reduceMotion: boolean): WithTimingConfig {
  return {
    duration: motionMs(segmentMotion.pressOutMs, reduceMotion),
    easing: easing.easeOut,
  };
}

/** Toggle thumb (if custom) — reuse global toggle spring */
export const toggleThumbSpring = spring.toggleThumb;
