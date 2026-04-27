import { Easing, FadeIn, FadeOut, Layout, type WithTimingConfig } from 'react-native-reanimated';
import { easing } from './tokens';
import { motionMs } from './presets';

/**
 * List & collection motion — quiet iOS-like pacing aligned with `tokens.ts`.
 */

export const listDuration = {
  micro: 120,
  rowState: 180,
  expandCollapse: 260,
  filterContent: 200,
  insert: 160,
  remove: 180,
} as const;

export const listTravel = {
  rowNudgeY: 6,
  rowNudgeYReduced: 2,
} as const;

/** Cell-level layout (use sparingly; disable if cells jitter) */
export const itemLayoutTransition = Layout.duration(listDuration.rowState);

/** Section chrome expand/collapse */
export const sectionExpandTransition = Layout.duration(listDuration.expandCollapse).easing(Easing.out(Easing.cubic));

export function rowInsertPreset(reduceMotion: boolean) {
  return FadeIn.duration(motionMs(listDuration.insert, reduceMotion)).easing(easing.easeOut);
}

export function rowRemovePreset(reduceMotion: boolean) {
  return FadeOut.duration(motionMs(listDuration.remove, reduceMotion)).easing(easing.easeIn);
}

export function checkStatePreset(reduceMotion: boolean): WithTimingConfig {
  return {
    duration: motionMs(listDuration.rowState, reduceMotion),
    easing: easing.easeInOut,
  };
}

export function filterContentPreset(reduceMotion: boolean): WithTimingConfig {
  return {
    duration: motionMs(listDuration.filterContent, reduceMotion),
    easing: easing.easeOut,
  };
}
