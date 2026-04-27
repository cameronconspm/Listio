import { spacing as baseSpacing } from './spacing';

/** Same shape as base `spacing` and `theme.spacing` (scaled). */
export type ThemeSpacing = typeof baseSpacing;

/**
 * Top padding below the native stack’s translucent header for tab empty states and list roots.
 * Matches Store / Recipes / List / Meals list bodies (`headerHeight + spacing.xxs`).
 */
export function tabScrollPaddingTopBelowHeader(
  headerHeight: number,
  spacing: ThemeSpacing,
): number {
  return headerHeight + spacing.xxs;
}

/**
 * When a horizontal ScrollView (chips/pills) sits inside a parent that already applies
 * `paddingHorizontal: inset`, wrap the ScrollView in a View with this style so the scroll
 * viewport reaches the screen edge while `contentContainerStyle` uses the same `inset` for
 * the first/last chip — avoids pills looking clipped by the padded “rail”.
 */
export function horizontalScrollInsetBleed(inset: number) {
  return { marginHorizontal: -inset } as const;
}

export { useSafeAreaInsets } from 'react-native-safe-area-context';
