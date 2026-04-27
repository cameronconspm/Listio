import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../design/ThemeContext';
import { BottomSheet } from '../ui/BottomSheet';
import { SelectorRow } from '../ui/SelectorRow';
import type { RecipeSortKey } from '../../services/recipeService';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';

export type { RecipeSortKey };

const SORT_OPTIONS: { key: RecipeSortKey; label: string }[] = [
  { key: 'updated_at', label: 'Recently updated' },
  { key: 'created_at', label: 'Recently created' },
  { key: 'name', label: 'Alphabetical' },
  { key: 'servings', label: 'Servings' },
  { key: 'ingredient_count', label: 'Ingredient count' },
];

export const RECIPE_SORT_LABELS: Record<RecipeSortKey, string> = {
  updated_at: 'Recently updated',
  created_at: 'Recently created',
  name: 'Alphabetical',
  servings: 'Servings',
  ingredient_count: 'Ingredient count',
};

type RecipeSortSheetProps = {
  visible: boolean;
  onClose: () => void;
  value: RecipeSortKey;
  onSelect: (sort: RecipeSortKey) => void;
};

/**
 * Bottom sheet for recipe sort options.
 * Same pattern as MealTypeOptionsSheet.
 */
export function RecipeSortSheet({ visible, onClose, value, onSelect }: RecipeSortSheetProps) {
  const theme = useTheme();

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.header}>
        <Text style={[theme.typography.headline, { color: theme.textPrimary }]}>Sort recipes</Text>
      </View>
      <View style={[styles.actions, { backgroundColor: theme.surface }]}>
        {SORT_OPTIONS.map((opt, i) => (
          <SelectorRow
            key={opt.key}
            label={opt.label}
            selected={value === opt.key}
            onPress={() => {
              onSelect(opt.key);
              onClose();
            }}
            showDivider={i > 0}
          />
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.lg,
  },
  actions: {
    overflow: 'hidden',
    borderRadius: radius.card,
  },
});
