import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../design/ThemeContext';
import { BottomSheet } from '../ui/BottomSheet';
import { SelectorRow } from '../ui/SelectorRow';
import type { RecipeCategory } from '../../types/models';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';

const OPTIONS: { key: RecipeCategory; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'dessert', label: 'Dessert' },
  { key: 'snack', label: 'Snack' },
  { key: 'other', label: 'Other' },
];

export const RECIPE_CATEGORY_LABELS: Record<RecipeCategory, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  dessert: 'Dessert',
  snack: 'Snack',
  other: 'Other',
};

type RecipeCategorySheetProps = {
  visible: boolean;
  onClose: () => void;
  value: RecipeCategory | null;
  onSelect: (category: RecipeCategory | null) => void;
};

/**
 * Bottom sheet for recipe category selection.
 * Same pattern as MealTypeOptionsSheet.
 */
export function RecipeCategorySheet({
  visible,
  onClose,
  value,
  onSelect,
}: RecipeCategorySheetProps) {
  const theme = useTheme();

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      surfaceVariant="solid"
      presentationVariant="action"
    >
      <View style={styles.header}>
        <Text style={[theme.typography.headline, { color: theme.textPrimary }]}>Category</Text>
      </View>
      <View style={[styles.actions, { backgroundColor: theme.surface }]}>
        <SelectorRow
          label="None"
          selected={value === null}
          onPress={() => {
            onSelect(null);
            onClose();
          }}
          showDivider={false}
        />
        {OPTIONS.map((opt, i) => (
          <SelectorRow
            key={opt.key}
            label={opt.label}
            selected={value === opt.key}
            onPress={() => {
              onSelect(opt.key);
              onClose();
            }}
            showDivider={true}
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
