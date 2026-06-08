/**
 * Brand display typeface — Plus Jakarta Sans (SIL OFL, see assets/fonts/OFL.txt).
 * A warm, rounded sans used for display titles and hero headlines only; body and
 * UI text stay on the system font for legibility and Dynamic Type. The rounded
 * forms are chosen to pair with the friendly Listio mascot (item 7).
 *
 * Family names are the exact keys used as `fontFamily` values, so they must
 * match the keys registered with `useFonts(appFontAssets)` in App.tsx.
 */
export const FONT_FAMILY = {
  displayMedium: 'PlusJakartaSans-Medium',
  displaySemiBold: 'PlusJakartaSans-SemiBold',
  displayBold: 'PlusJakartaSans-Bold',
} as const;

export type AppFontFamily = (typeof FONT_FAMILY)[keyof typeof FONT_FAMILY];

/** Asset map consumed by `useFonts` — keys become usable `fontFamily` values. */
export const appFontAssets = {
  [FONT_FAMILY.displayMedium]: require('../../assets/fonts/PlusJakartaSans-Medium.ttf'),
  [FONT_FAMILY.displaySemiBold]: require('../../assets/fonts/PlusJakartaSans-SemiBold.ttf'),
  [FONT_FAMILY.displayBold]: require('../../assets/fonts/PlusJakartaSans-Bold.ttf'),
};
