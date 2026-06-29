import type { ViewStyle } from 'react-native';
import { spacing } from './spacing';

/** Vertical gap between stacked recipe cards / sections (list, edit, detail). */
export const RECIPE_CARD_GAP = spacing.md;

/** Shared `ListSection` style for recipe edit + detail screens. */
export const recipeSectionStyle: ViewStyle = {
  marginBottom: RECIPE_CARD_GAP,
};

/** Inner padding for recipe list row cards — matches dense `ListSection` shell. */
export const recipeCardInnerPadding: ViewStyle = {
  paddingVertical: spacing.sm,
  paddingHorizontal: spacing.md,
};

/** Preset props for recipe form / detail section cards. */
export const recipeListSectionProps = {
  titleVariant: 'small' as const,
  glass: false as const,
  dense: true as const,
  style: recipeSectionStyle,
};

/** Row-only recipe/meal sections — title inset matches `ListRow` labels. */
export const recipeRowListSectionProps = {
  ...recipeListSectionProps,
  contentFlush: true as const,
};

/** Gap between stacked full-width CTAs on recipe detail / import flows. */
export const RECIPE_ACTION_STACK_GAP = spacing.sm;

/** Wrap primary + secondary recipe CTAs with consistent vertical rhythm. */
export const recipeActionStackStyle: ViewStyle = {
  alignSelf: 'stretch',
  gap: RECIPE_ACTION_STACK_GAP,
};
