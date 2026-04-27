import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/ThemeContext';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Week strip + planned meals — matches Meals tab. */
export function OnboardingMealsFeatured() {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: theme.surface,
          borderColor: theme.divider,
        },
        theme.shadows.card,
      ]}
    >
      <View style={styles.mockHeader}>
        <Ionicons name="restaurant-outline" size={18} color={theme.accent} />
        <Text style={[theme.typography.subhead, { color: theme.textPrimary, marginLeft: theme.spacing.sm, fontWeight: '600' }]}>
          Meals
        </Text>
      </View>

      <View style={styles.weekRow}>
        {DAYS.map((d, i) => (
          <View
            key={`${d}-${i}`}
            style={[
              styles.dayCell,
              i === 2 && { backgroundColor: theme.accent + '18' },
              i !== 2 && { backgroundColor: theme.background },
            ]}
          >
            <Text
              style={[
                theme.typography.caption2,
                { fontWeight: '700', color: i === 2 ? theme.accent : theme.textSecondary },
              ]}
            >
              {d}
            </Text>
          </View>
        ))}
      </View>

      <Text style={[theme.typography.caption1, { color: theme.textSecondary, marginTop: theme.spacing.md, marginBottom: theme.spacing.sm, lineHeight: 19 }]}>
        Pick what you are cooking across the week. When you are ready, send ingredients to your list in one action.
      </Text>

      <View style={[styles.mealRow, { borderTopColor: theme.divider, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: theme.spacing.md }]}>
        <View style={[styles.dot, { backgroundColor: theme.accent }]} />
        <Text style={[theme.typography.footnote, { color: theme.textPrimary, flex: 1 }]} numberOfLines={1}>
          Wed · Sheet-pan salmon with greens
        </Text>
      </View>
      <View style={[styles.mealRow, { marginTop: theme.spacing.sm }]}>
        <View style={[styles.dot, { backgroundColor: theme.textSecondary + '55' }]} />
        <Text style={[theme.typography.caption1, { color: theme.textSecondary, flex: 1 }]} numberOfLines={1}>
          Thu · Pasta night
        </Text>
      </View>

      <View style={[styles.hintRow, { marginTop: theme.spacing.md }]}>
        <Ionicons name="arrow-forward-circle" size={18} color={theme.accent} />
        <Text style={[theme.typography.caption1, { color: theme.textSecondary, marginLeft: theme.spacing.sm, flex: 1, lineHeight: 19 }]}>
          Add ingredients from a meal to your list without retyping each line.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
  },
  mockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    minWidth: 0,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.sm,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
});
