import { spacing as baseSpacing } from './spacing';

/** Same shape as base `spacing` and `theme.spacing` (scaled). */
export type ThemeSpacing = typeof baseSpacing;

export const TAB_ROOT_HEADER_ROW_HEIGHT = 44;

/** Extra chrome row when the list tab shows the multi-list switcher above Plan/Shop. */
export const LIST_TAB_LIST_SWITCHER_ROW_HEIGHT = 44;

/** Fixed Plan/Shop segmented control row (below list switcher). */
export const LIST_TAB_MODE_TOGGLE_ROW_HEIGHT = 44;

/**
 * Explicit tab-root chrome height. Native-stack custom header measurement can
 * change during first mount; tab roots use this fixed geometry for stable layout.
 */
export function tabRootHeaderHeight(
  safeAreaTop: number,
  spacing: ThemeSpacing,
): number {
  return safeAreaTop + spacing.sm + TAB_ROOT_HEADER_ROW_HEIGHT + spacing.xs;
}

/** Height of the list switcher row in the fixed header (safe area + switcher). */
export function listTabSwitcherHeaderHeight(
  safeAreaTop: number,
  spacing: ThemeSpacing,
): number {
  return safeAreaTop + LIST_TAB_LIST_SWITCHER_ROW_HEIGHT + spacing.xs;
}

/**
 * Scroll inset below fixed list-tab chrome (switcher row + optional Plan/Shop toggle).
 * Plan/Shop is pinned outside the FlatList so toggling does not remeasure list headers.
 */
export function listTabFixedHeaderScrollInset(
  safeAreaTop: number,
  spacing: ThemeSpacing,
  options?: { showListSwitcher?: boolean; showModeToggle?: boolean }
): number {
  const showSwitcher = options?.showListSwitcher ?? false;
  const showModeToggle = options?.showModeToggle ?? false;

  let inset = showSwitcher
    ? listTabSwitcherHeaderHeight(safeAreaTop, spacing)
    : safeAreaTop + spacing.sm;

  if (showModeToggle) {
    inset += LIST_TAB_MODE_TOGGLE_ROW_HEIGHT + spacing.sm;
  }

  return inset + spacing.xxs;
}

/** Scroll inset below the fixed list switcher header (Plan/Shop toggle scrolls in content). */
export function listTabScrollPaddingTop(
  safeAreaTop: number,
  spacing: ThemeSpacing,
  options?: { showListSwitcher?: boolean },
): number {
  return listTabFixedHeaderScrollInset(safeAreaTop, spacing, {
    showListSwitcher: options?.showListSwitcher ?? false,
    showModeToggle: false,
  });
}

export function tabRootScrollPaddingTop(
  safeAreaTop: number,
  spacing: ThemeSpacing,
): number {
  return tabRootHeaderHeight(safeAreaTop, spacing) + spacing.xxs;
}

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
 * Bottom inset for tab-root scroll content. `tabBarHeight` from `useBottomTabBarHeight()`
 * already includes the home-indicator safe area — do not add `insets.bottom` again.
 */
export function tabRootScrollPaddingBottom(
  tabBarHeight: number,
  spacing: ThemeSpacing,
): number {
  return tabBarHeight + spacing.md;
}

/** Bottom inset when the tab bar is hidden (pushed stack screens). */
export function scrollPaddingBottomWithoutTabBar(
  safeAreaBottom: number,
  spacing: ThemeSpacing,
): number {
  return safeAreaBottom + spacing.md;
}

/** Resting `bottom` for FABs and sticky quick-add bars above the tab bar overlay. */
export function tabRootFloatingControlBottom(
  tabBarHeight: number,
  spacing: ThemeSpacing,
): number {
  return tabBarHeight + spacing.sm;
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
