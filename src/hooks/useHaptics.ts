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
  /**
   * Celebratory "ta-da" for the app's peak moments (e.g. finishing a shop run):
   * a success note followed by two light taps for a richer payoff than `success`.
   */
  celebrate: () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, 130);
    setTimeout(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, 260);
  },
});

export type HapticsHandle = typeof HAPTICS;

/** Same singleton as `useHaptics`, for non-React contexts (services, fire-and-forget flows). */
export const appHaptics: HapticsHandle = HAPTICS;

export function useHaptics(): HapticsHandle {
  return HAPTICS;
}
