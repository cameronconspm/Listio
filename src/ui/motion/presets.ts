import type { WithTimingConfig } from 'react-native-reanimated';
import { distance, duration, easing, reducedMotionMultiplier, spring } from './tokens';

export type MotionKind = 'press' | 'state' | 'menu' | 'dialog' | 'sheet';

export function motionMs(ms: number, reduceMotion: boolean): number {
  if (!reduceMotion) return ms;
  return Math.max(60, Math.round(ms * reducedMotionMultiplier));
}

/** Legacy short travel (px) for callers not using full-height sheet motion */
export function motionTranslateOffset(reduceMotion: boolean): number {
  return reduceMotion ? distance.reducedSheetTravel : 28;
}

export function getMotionTiming(kind: MotionKind, reduceMotion: boolean) {
  switch (kind) {
    case 'press':
      return {
        duration: motionMs(duration.pressIn, reduceMotion),
        easing: easing.easeInOut,
      } satisfies WithTimingConfig;
    case 'state':
      return {
        duration: motionMs(duration.standard, reduceMotion),
        easing: easing.easeInOut,
      } satisfies WithTimingConfig;
    case 'menu':
      return {
        present: {
          duration: motionMs(duration.menuPresent, reduceMotion),
          easing: easing.easeOut,
        } satisfies WithTimingConfig,
        dismiss: {
          duration: motionMs(duration.menuDismiss, reduceMotion),
          easing: easing.easeIn,
        } satisfies WithTimingConfig,
      };
    case 'dialog':
      return {
        present: {
          duration: motionMs(duration.alertEnter, reduceMotion),
          easing: easing.easeOut,
        } satisfies WithTimingConfig,
        dismiss: {
          duration: motionMs(duration.alertExit, reduceMotion),
          easing: easing.easeIn,
        } satisfies WithTimingConfig,
      };
    case 'sheet':
      return {
        present: {
          duration: motionMs(duration.modalEnter, reduceMotion),
          easing: easing.easeOut,
        } satisfies WithTimingConfig,
        dismiss: {
          duration: motionMs(duration.modalExit, reduceMotion),
          easing: easing.easeIn,
        } satisfies WithTimingConfig,
      };
  }
}

/** Modal sheet enter (translate to rest) */
export function modalEnterTiming(reduceMotion: boolean): WithTimingConfig {
  return {
    duration: motionMs(duration.modalEnter, reduceMotion),
    easing: easing.easeOut,
  };
}

/** Sheet slides off-screen: easeOut so motion decelerates (matches iOS keyboard hide curve). easeIn made the sheet accelerate at the end and fight the keyboard. */
export function modalExitTiming(reduceMotion: boolean): WithTimingConfig {
  return {
    duration: motionMs(duration.modalExit, reduceMotion),
    easing: easing.easeOut,
  };
}

export function backdropTiming(reduceMotion: boolean): WithTimingConfig {
  return {
    duration: motionMs(duration.backdrop, reduceMotion),
    easing: easing.easeOut,
  };
}

export function pressInTiming(reduceMotion: boolean): WithTimingConfig {
  return {
    duration: motionMs(duration.pressIn, reduceMotion),
    easing: easing.easeOut,
  };
}

export function pressOutTiming(reduceMotion: boolean): WithTimingConfig {
  return {
    duration: motionMs(duration.pressOut, reduceMotion),
    easing: easing.easeOut,
  };
}

/** Re-export token groups for convenience */
export { backdrop as motionBackdrop } from './tokens';
export const motionDistance = distance;
export const motionEasing = {
  present: easing.easeOut,
  dismiss: easing.easeIn,
  settle: easing.easeInOut,
} as const;

export const motionSpring = spring;

/** @deprecated Prefer `duration` from tokens — kept for legacy imports */
export const motionDuration = {
  press: duration.pressIn,
  state: duration.standard,
  menuPresent: duration.menuPresent,
  menuDismiss: duration.menuDismiss,
  dialogPresent: duration.alertEnter,
  dialogDismiss: duration.alertExit,
  sheetPresent: duration.modalEnter,
  sheetDismiss: duration.modalExit,
} as const;
