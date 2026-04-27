import { Easing } from 'react-native-reanimated';

/**
 * Central motion tokens for overlay and control animations.
 * Durations are implementation targets for an iOS-like feel, not Apple-published constants.
 */

/** Durations (ms) */
export const duration = {
  micro: 120,
  fast: 180,
  standard: 240,
  modalEnter: 320,
  modalExit: 260,
  backdrop: 220,
  /** Alert / dialog */
  alertEnter: 200,
  alertExit: 160,
  /** Anchored menus */
  menuPresent: 160,
  menuDismiss: 140,
  /** Button press */
  pressIn: 88,
  pressOut: 140,
  /** Toggle track cross-fade */
  toggleTrack: 180,
  /** FAB hides label while list is scrolling (quick, no bounce) */
  fabScrollCollapse: 150,
  /** FAB settles after scroll stops (when Reduce Motion is on) */
  fabScrollSettleRM: 220,
} as const;

/** Easing curves */
export const easing = {
  /** Entrances, non-interactive */
  easeOut: Easing.out(Easing.cubic),
  /** Simple state changes */
  easeInOut: Easing.inOut(Easing.cubic),
  /** Picks up speed toward the end (use sparingly; modal sheet exit uses easeOut). */
  easeIn: Easing.in(Easing.cubic),
} as const;

/** Restrained spring presets — no bouncy modal presentation */
export const spring = {
  sheetSnap: {
    damping: 28,
    stiffness: 240,
    mass: 0.9,
    overshootClamping: true,
  },
  sheetReturn: {
    damping: 30,
    stiffness: 260,
    mass: 0.9,
    overshootClamping: true,
  },
  toggleThumb: {
    damping: 22,
    stiffness: 280,
    mass: 0.8,
    overshootClamping: false,
  },
  /** FAB expand/collapse (label ↔ icon) */
  fabExpand: {
    damping: 26,
    stiffness: 320,
    mass: 0.75,
    overshootClamping: true,
  },
  /** FAB press micro-interaction */
  fabPress: {
    damping: 18,
    stiffness: 420,
    mass: 0.55,
    overshootClamping: false,
  },
  /** FAB label vs + after scroll settles — fluid, minimal overshoot (HIG-adjacent) */
  fabSettle: {
    damping: 22,
    stiffness: 340,
    mass: 0.78,
    overshootClamping: true,
  },
} as const;

/** Backdrop opacity multipliers (black layer) */
export const backdrop = {
  dim: 0.28,
  dimMenu: 0.08,
} as const;

/** Gesture / dismissal */
export const threshold = {
  /** Downward velocity (pt/s) — fling to dismiss */
  sheetDismissVelocity: 900,
  /** Fraction of measured sheet height */
  sheetDismissProgress: 0.35,
  /** Minimum drag distance before comparing to progress (pt) */
  sheetDismissMinDrag: 72,
} as const;

/** Distances (px) */
export const distance = {
  /** Sheet travel when Reduce Motion is on */
  reducedSheetTravel: 12,
  /** Menu / dialog scale */
  menuScaleFrom: 0.985,
  dialogScaleFrom: 0.98,
  /** Popover vertical nudge */
  popoverTranslate: 4,
  /** Button press scale */
  pressScaleDown: 0.985,
} as const;

/** Reduce Motion: scale global durations */
export const reducedMotionMultiplier = 0.35;
