import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../design/ThemeContext';
import type { RecipeIngredient } from '../../types/models';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';
import { formatScaledIngredientQuantityDisplay } from '../../utils/formatScaledIngredientAmount';

type IngredientListProps = {
  ingredients: RecipeIngredient[];
  /** When false, omit the "Ingredients" headline (e.g. when used inside ListSection). */
  showTitle?: boolean;
};

function IngredientAmountPill({
  quantityValue,
  quantityUnit,
  ingredientName,
}: {
  quantityValue: number;
  quantityUnit: string;
  ingredientName: string;
}) {
  const theme = useTheme();
  const label = formatScaledIngredientQuantityDisplay(quantityValue, quantityUnit, ingredientName);
  return (
    <View style={[styles.amountPill, { backgroundColor: theme.textSecondary + '16' }]}>
      <Text style={[theme.typography.caption1, { color: theme.textPrimary }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

export function IngredientList({ ingredients, showTitle = true }: IngredientListProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      {showTitle ? (
        <Text style={[theme.typography.headline, { color: theme.textPrimary, marginBottom: theme.spacing.sm }]}>
          Ingredients
        </Text>
      ) : null}
      {ingredients.map((ing, idx) => {
        const hasAmount = ing.quantity_value != null && Boolean(ing.quantity_unit?.trim());
        return (
          <View
            key={ing.id}
            style={[
              styles.row,
              idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider },
            ]}
          >
            <View style={styles.rowInner}>
              <View style={styles.nameBlock}>
                <Text style={[theme.typography.body, { color: theme.textPrimary }]}>{ing.name}</Text>
                {ing.notes?.trim() ? (
                  <Text style={[theme.typography.footnote, { color: theme.textSecondary, marginTop: theme.spacing.xs }]}>
                    {ing.notes.trim()}
                  </Text>
                ) : null}
              </View>
              {hasAmount ? (
                <IngredientAmountPill
                  quantityValue={ing.quantity_value!}
                  quantityUnit={ing.quantity_unit!.trim()}
                  ingredientName={ing.name}
                />
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: spacing.xs },
  row: {
    paddingVertical: spacing.md,
    paddingHorizontal: 0,
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
  amountPill: {
    maxWidth: '42%',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
});
