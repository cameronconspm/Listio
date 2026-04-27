import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../design/ThemeContext';
import { GlassSurface } from '../ui/GlassSurface';
import type { Meal } from '../../types/models';
import { spacing } from '../../design/spacing';

type MealPlannerCardProps = {
  meal: Meal;
  ingredientCount: number;
  onPress: () => void;
};

export function MealPlannerCard({ meal, ingredientCount, onPress }: MealPlannerCardProps) {
  const theme = useTheme();

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.wrapper}>
      <GlassSurface style={styles.card} borderRadius={theme.radius.glass}>
        <Text style={[theme.typography.subhead, { color: theme.textPrimary }]} numberOfLines={1}>
          {meal.name}
        </Text>
        <Text style={[theme.typography.caption1, { color: theme.textSecondary, marginTop: 2 }]}>
          {ingredientCount} ingredient{ingredientCount !== 1 ? 's' : ''}
        </Text>
      </GlassSurface>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, marginLeft: spacing.sm },
  card: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
});
