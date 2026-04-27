import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../design/ThemeContext';
import { GlassSurface } from '../ui/GlassSurface';
import type { Meal } from '../../types/models';
import { spacing } from '../../design/spacing';

type MealCardProps = {
  meal: Meal;
  onPress: () => void;
};

function MealCardInner({ meal, onPress }: MealCardProps) {
  const theme = useTheme();
  const dateRange =
    meal.start_date && meal.end_date
      ? `${meal.start_date} – ${meal.end_date}`
      : meal.start_date
        ? meal.start_date
        : null;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.wrapper}>
      <GlassSurface style={styles.card} borderRadius={theme.radius.glass}>
        <Text style={[theme.typography.headline, { color: theme.textPrimary }]}>{meal.name}</Text>
        {dateRange ? (
          <Text style={[theme.typography.footnote, { color: theme.textSecondary, marginTop: theme.spacing.xs }]}>
            {dateRange}
          </Text>
        ) : null}
      </GlassSurface>
    </TouchableOpacity>
  );
}

export const MealCard = React.memo(MealCardInner);

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.sm },
  card: {
    padding: spacing.md,
  },
});
