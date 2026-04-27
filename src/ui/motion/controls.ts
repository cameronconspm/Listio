import { Easing, type WithTimingConfig } from 'react-native-reanimated';
import { easing, spring } from './tokens';
import { motionMs } from './presets';

/** Segmented pill / iOS-style segment motion */
export const segmentMotion = {
  pillShiftMs: 200,
  pressScale: 0.988,
  pressInMs: 88,
  pressOutMs: 130,
} as const;

export function segmentPillTiming(reduceMotion: boolean): WithTimingConfig {
  return {
    duration: motionMs(segmentMotion.pillShiftMs, reduceMotion),
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
