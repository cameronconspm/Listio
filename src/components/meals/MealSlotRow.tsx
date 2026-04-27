import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/ThemeContext';
import { RecipeMetaPills } from '../recipes/RecipeMetaPills';
import type { Meal } from '../../types/models';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';

const SLOT_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  dessert: 'Dessert',
  custom: 'Custom',
};

/** Empty rows: label column width so + Add lines up across slots. */
const SLOT_LABEL_COL_W = 96;

type MealSlotRowProps = {
  slotKey: string;
  slotLabel: string;
  meal: Meal | null;
  ingredientCount: number;
  onPressMeal: () => void;
  onPressAdd: () => void;
};

function displaySlotLabel(slotKey: string, slotLabel: string): string {
  if (slotKey.startsWith('custom:')) {
    return slotLabel.trim() || 'Custom';
  }
  return SLOT_LABELS[slotKey] ?? slotLabel.charAt(0).toUpperCase() + slotLabel.slice(1).toLowerCase();
}

/**
 * Empty: compact label + Add. Filled: slot as eyebrow, then a full-width inset tile
 * (recipe-card rhythm: title, then meta pills) so label / title / pills are not crammed on one line.
 */
export function MealSlotRow({
  slotKey,
  slotLabel,
  meal,
  ingredientCount,
  onPressMeal,
  onPressAdd,
}: MealSlotRowProps) {
  const theme = useTheme();
  const label = displaySlotLabel(slotKey, slotLabel);

  if (meal) {
    return (
      <TouchableOpacity
        style={[styles.filledWrap, { borderBottomColor: theme.divider }]}
        onPress={onPressMeal}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${meal.name}`}
      >
        <Text style={[theme.typography.footnote, { color: theme.textSecondary, marginBottom: theme.spacing.sm }]}>
          {label}
        </Text>
        <View
          style={[
            styles.mealTile,
            {
              backgroundColor: theme.background,
              borderColor: theme.divider,
            },
          ]}
        >
          <View style={styles.mealTitleRow}>
            <Text style={[theme.typography.headline, styles.mealTitle, { color: theme.textPrimary }]} numberOfLines={2}>
              {meal.name}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} style={styles.mealChevron} />
          </View>
          <View style={styles.pillsWrap}>
            <RecipeMetaPills
              labels={[`${ingredientCount} ingredient${ingredientCount !== 1 ? 's' : ''}`]}
            />
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.emptyRow, { borderBottomColor: theme.divider }]}
      onPress={onPressAdd}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Add meal, ${label}`}
    >
      <Text
        style={[theme.typography.subhead, styles.emptySlotLabel, { color: theme.textSecondary }]}
        numberOfLines={2}
      >
        {label}
      </Text>
      <View style={styles.rowRight}>
        <Text style={[theme.typography.body, { color: theme.accent }]}>+ Add</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  filledWrap: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  mealTile: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    overflow: 'hidden',
  },
  mealTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  mealTitle: {
    flex: 1,
    minWidth: 0,
    paddingRight: spacing.sm,
  },
  mealChevron: {
    marginTop: 2,
  },
  pillsWrap: {
    marginTop: spacing.sm,
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 56,
  },
  emptySlotLabel: {
    width: SLOT_LABEL_COL_W,
    flexShrink: 0,
    paddingRight: spacing.sm,
  },
  rowRight: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 0,
  },
});
