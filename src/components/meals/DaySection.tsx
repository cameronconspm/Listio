import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../design/ThemeContext';
import { MealSlotRow } from './MealSlotRow';
import { Card } from '../ui/Card';
import type { Meal } from '../../types/models';
import type { RecipePlannerMeta } from '../../services/mealService';
import { spacing } from '../../design/spacing';

const FIXED_SLOTS = ['breakfast', 'lunch', 'dinner', 'dessert'] as const;

type DaySectionProps = {
  dateLabel: string;
  dateString: string;
  mealsBySlot: Map<string, Meal>;
  ingredientCountByMealId: Record<string, number>;
  recipeMetaByRecipeId: Record<string, RecipePlannerMeta>;
  onPressMeal: (meal: Meal) => void;
  onPressAdd: (dateString: string, slotKey: string, slotLabel: string) => void;
  onDeleteMeal: (meal: Meal) => void;
};

function DaySectionInner({
  dateLabel,
  dateString,
  mealsBySlot,
  ingredientCountByMealId,
  recipeMetaByRecipeId,
  onPressMeal,
  onPressAdd,
  onDeleteMeal,
}: DaySectionProps) {
  const theme = useTheme();

  const customSlots = Array.from(mealsBySlot.entries())
    .filter(([k]) => k.startsWith('custom:'))
    .map(([k]) => k);

  return (
    <View style={styles.section}>
      <Text style={[theme.typography.title3, styles.dayHeading, { color: theme.textPrimary }]}>
        {dateLabel}
      </Text>
      <Card glass={false} style={[styles.slotsCard, theme.shadows.card]}>
        <View style={styles.slots}>
          {FIXED_SLOTS.map((slotKey) => {
            const m = mealsBySlot.get(slotKey) ?? null;
            const rid = m?.recipe_id ?? null;
            const recipeMeta = rid ? recipeMetaByRecipeId[rid] ?? null : null;
            const displayLabel = slotKey.charAt(0).toUpperCase() + slotKey.slice(1);
            return (
              <MealSlotRow
                key={slotKey}
                slotKey={slotKey}
                slotLabel={displayLabel}
                meal={m}
                recipeMeta={recipeMeta}
                ingredientCount={ingredientCountByMealId[m?.id ?? ''] ?? 0}
                onPressMeal={() => {
                  if (m) onPressMeal(m);
                }}
                onPressAdd={() => onPressAdd(dateString, slotKey, displayLabel)}
                onDeleteMeal={onDeleteMeal}
              />
            );
          })}
          {customSlots.map((slotKey) => {
            const label = slotKey.replace('custom:', '');
            const meal = mealsBySlot.get(slotKey) ?? null;
            const rid = meal?.recipe_id ?? null;
            const recipeMeta = rid ? recipeMetaByRecipeId[rid] ?? null : null;
            return (
              <MealSlotRow
                key={slotKey}
                slotKey={slotKey}
                slotLabel={label}
                meal={meal}
                recipeMeta={recipeMeta}
                ingredientCount={ingredientCountByMealId[meal?.id ?? ''] ?? 0}
                onPressMeal={() => {
                  if (meal) onPressMeal(meal);
                }}
                onPressAdd={() => onPressAdd(dateString, slotKey, label)}
                onDeleteMeal={onDeleteMeal}
              />
            );
          })}
        </View>
      </Card>
    </View>
  );
}

export const DaySection = React.memo(DaySectionInner);

const styles = StyleSheet.create({
  section: {},
  dayHeading: {
    marginBottom: spacing.sm,
  },
  slotsCard: {
    overflow: 'visible',
    padding: 0,
  },
  slots: {
    overflow: 'visible',
  },
});
