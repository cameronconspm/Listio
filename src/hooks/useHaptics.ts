import * as Haptics from 'expo-haptics';

/** Module-level frozen singleton: `useHaptics` is read by every list row and
 *  every sheet, so returning a fresh object literal per render used to break
 *  `React.memo` for consumers. Now hook consumers get the same reference on
 *  every render. */
const HAPTICS = Object.freeze({
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  /** For scroll-wheel / picker style feedback when crossing boundaries (e.g. reordering). */
  selection: () => Haptics.selectionAsync(),
});

export type HapticsHandle = typeof HAPTICS;

export function useHaptics(): HapticsHandle {
  return HAPTICS;
}
