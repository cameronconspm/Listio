import type { ColorScheme } from '../../design/theme';

/**
 * Shared navigation chrome (headers + tab bar): one blur/tint language app-wide.
 * Restrained — neutral, not decorative; blur is the base, tint only aids readability.
 */
export const navigationChromeBlur = {
  /** Single iOS intensity for top + bottom chrome (was split; split caused mismatch). */
  chrome: 56,
  chromeAndroid: 48,
} as const;

/**
 * Neutral veil on top of blur: desaturates content color bleed (e.g. green accents)
 * without loud glass or heavy opacity.
 */
export function navigationChromeTintOverlay(scheme: ColorScheme): string {
  return scheme === 'dark'
    ? 'rgba(22, 22, 24, 0.42)'
    : 'rgba(255, 255, 255, 0.26)';
}

/**
 * Kept for API compatibility (Metro cache / older bundles may still resolve this).
 * Navigation chrome no longer draws hairlines — returns transparent.
 */
export function navigationChromeHairline(_scheme: ColorScheme): string {
  return 'transparent';
}
