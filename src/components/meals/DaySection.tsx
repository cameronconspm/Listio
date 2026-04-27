import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../design/ThemeContext';
import { MealSlotRow } from './MealSlotRow';
import { Card } from '../ui/Card';
import type { Meal } from '../../types/models';
import { spacing } from '../../design/spacing';

const FIXED_SLOTS = ['breakfast', 'lunch', 'dinner', 'dessert'] as const;

type DaySectionProps = {
  dateLabel: string;
  dateString: string;
  mealsBySlot: Map<string, Meal>;
  ingredientCountByMealId: Record<string, number>;
  onPressMeal: (meal: Meal) => void;
  onPressAdd: (dateString: string, slotKey: string, slotLabel: string) => void;
};

function DaySectionInner({
  dateLabel,
  dateString,
  mealsBySlot,
  ingredientCountByMealId,
  onPressMeal,
  onPressAdd,
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
          {FIXED_SLOTS.map((slotKey) => (
            <MealSlotRow
              key={slotKey}
              slotKey={slotKey}
              slotLabel={slotKey}
              meal={mealsBySlot.get(slotKey) ?? null}
              ingredientCount={
                ingredientCountByMealId[mealsBySlot.get(slotKey)?.id ?? ''] ?? 0
              }
              onPressMeal={() => {
                const m = mealsBySlot.get(slotKey);
                if (m) onPressMeal(m);
              }}
              onPressAdd={() => onPressAdd(dateString, slotKey, slotKey)}
            />
          ))}
          {customSlots.map((slotKey) => {
            const label = slotKey.replace('custom:', '');
            const meal = mealsBySlot.get(slotKey) ?? null;
            return (
              <MealSlotRow
                key={slotKey}
                slotKey={slotKey}
                slotLabel={label}
                meal={meal}
                ingredientCount={ingredientCountByMealId[meal?.id ?? ''] ?? 0}
                onPressMeal={() => {
                  if (meal) onPressMeal(meal);
                }}
                onPressAdd={() => onPressAdd(dateString, slotKey, label)}
              />
            );
          })}
        </View>
        <TouchableOpacity
          style={[styles.addCustomRow, { borderTopColor: theme.divider }]}
          onPress={() => onPressAdd(dateString, '', '')}
          activeOpacity={0.7}
        >
          <Text style={[theme.typography.body, { color: theme.accent }]}>+ Add custom meal</Text>
        </TouchableOpacity>
      </Card>
    </View>
  );
}

export const DaySection = React.memo(DaySectionInner);

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.lg,
  },
  dayHeading: {
    marginBottom: spacing.sm,
  },
  slotsCard: {
    overflow: 'hidden',
    padding: 0,
  },
  slots: {
    overflow: 'hidden',
  },
  addCustomRow: {
    minHeight: 64,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
