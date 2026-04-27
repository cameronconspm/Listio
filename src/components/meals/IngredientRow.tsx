import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../design/ThemeContext';
import { RecipePill } from '../recipes/RecipePill';
import type { MealIngredient } from '../../types/models';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';
import { formatScaledIngredientQuantityDisplay } from '../../utils/formatScaledIngredientAmount';

type IngredientRowProps = {
  ingredient: MealIngredient;
  /** When defined, shows on-list vs missing status */
  isOnList?: boolean;
  /** When false, omit top divider (first row in section). */
  showTopDivider?: boolean;
};

function StatusPill({ onList }: { onList: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.statusPill,
        {
          backgroundColor: onList ? theme.accent + '22' : theme.textSecondary + '16',
        },
      ]}
    >
      <Text
        style={[
          theme.typography.caption1,
          { color: onList ? theme.accent : theme.textSecondary, fontWeight: '600' },
        ]}
      >
        {onList ? 'On list' : 'Missing'}
      </Text>
    </View>
  );
}

/**
 * Meal ingredient row aligned with recipe ingredient list: name + notes, amount pill, list status.
 */
function IngredientRowInner({
  ingredient,
  isOnList,
  showTopDivider = true,
}: IngredientRowProps) {
  const theme = useTheme();
  const hasAmount = ingredient.quantity_value != null && Boolean(ingredient.quantity_unit?.trim());
  const detail =
    [ingredient.notes, ingredient.brand_preference].filter(Boolean).join(' · ') || null;

  return (
    <View
      style={[
        styles.row,
        showTopDivider && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.divider,
        },
      ]}
    >
      <View style={styles.rowInner}>
        <View style={styles.nameBlock}>
          <Text style={[theme.typography.body, { color: theme.textPrimary }]}>{ingredient.name}</Text>
          {detail ? (
            <Text style={[theme.typography.footnote, { color: theme.textSecondary, marginTop: theme.spacing.xs }]}>
              {detail}
            </Text>
          ) : null}
        </View>
        <View style={styles.rightCol}>
          {hasAmount ? (
            <RecipePill
              label={formatScaledIngredientQuantityDisplay(
                ingredient.quantity_value!,
                ingredient.quantity_unit!.trim(),
                ingredient.name
              )}
            />
          ) : null}
          {isOnList !== undefined ? <StatusPill onList={isOnList} /> : null}
        </View>
      </View>
    </View>
  );
}

export const IngredientRow = React.memo(IngredientRowInner);

const styles = StyleSheet.create({
  row: {
    paddingVertical: spacing.md,
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  nameBlock: {
    flex: 1,
    minWidth: 0,
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: spacing.xs,
    maxWidth: '44%',
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
    alignSelf: 'flex-end',
  },
});
