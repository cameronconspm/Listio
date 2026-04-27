import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/ThemeContext';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';
/** Stacked preview cards — List (Plan/Shop), Meals, Recipes. */
export function OnboardingWelcomeFeatured() {
  const theme = useTheme();

  return (
    <View style={styles.stack}>
      <View style={[styles.overlap, { marginBottom: -14, zIndex: 3 }]}>
        <View
          style={[
            styles.mini,
            {
              backgroundColor: theme.surface,
              borderColor: theme.divider,
            },
            theme.shadows.floating,
          ]}
        >
          <View style={styles.cardHeader}>
            <Ionicons name="list" size={16} color={theme.accent} />
            <Text style={[theme.typography.caption1, { color: theme.textSecondary, marginLeft: theme.spacing.xs }]}>List</Text>
          </View>
          <View style={[styles.segment, { backgroundColor: theme.background }]}>
            <View style={[styles.segmentPill, { backgroundColor: theme.surface }]}>
              <Text style={[theme.typography.caption2, { color: theme.accent, fontWeight: '700' }]}>Plan</Text>
            </View>
            <Text style={[theme.typography.caption2, { color: theme.textSecondary, fontWeight: '600', marginLeft: theme.spacing.sm }]}>
              Shop
            </Text>
          </View>
          <View style={[styles.pill, { backgroundColor: theme.accent + '18', marginTop: theme.spacing.sm }]}>
            <Text style={[theme.typography.caption2, { color: theme.accent, fontWeight: '600' }]}>Produce</Text>
          </View>
          <Text style={[theme.typography.footnote, { color: theme.textPrimary, marginTop: theme.spacing.sm }]}>
            Kale · <Text style={{ fontWeight: '600' }}>2</Text> bunches
          </Text>
          <Text style={[theme.typography.caption1, { color: theme.textSecondary, marginTop: theme.spacing.xxs }]}>Bananas · 5</Text>
        </View>
      </View>

      <View style={[styles.overlap, { marginBottom: -14, zIndex: 2 }]}>
        <View
          style={[
            styles.mini,
            {
              backgroundColor: theme.surface,
              borderColor: theme.divider,
            },
            theme.shadows.elevated,
          ]}
        >
          <View style={styles.cardHeader}>
            <Ionicons name="restaurant-outline" size={16} color={theme.accent} />
            <Text style={[theme.typography.caption1, { color: theme.textSecondary, marginLeft: theme.spacing.xs }]}>Meals</Text>
          </View>
          <View style={styles.mealRow}>
            <View style={[styles.dot, { backgroundColor: theme.accent }]} />
            <Text style={[theme.typography.footnote, { color: theme.textPrimary, flex: 1 }]} numberOfLines={1}>
              Tue · Sheet-pan salmon
            </Text>
          </View>
          <View style={[styles.mealRow, { marginTop: theme.spacing.xs }]}>
            <View style={[styles.dot, { backgroundColor: theme.textSecondary + '55' }]} />
            <Text style={[theme.typography.caption1, { color: theme.textSecondary, flex: 1 }]} numberOfLines={1}>
              Wed · Pasta night
            </Text>
          </View>
        </View>
      </View>

      <View style={{ zIndex: 1 }}>
        <View
          style={[
            styles.mini,
            {
              backgroundColor: theme.surface,
              borderColor: theme.divider,
            },
            theme.shadows.card,
          ]}
        >
          <View style={styles.cardHeader}>
            <Ionicons name="book-outline" size={15} color={theme.accent} />
            <Text style={[theme.typography.caption1, { color: theme.textSecondary, marginLeft: theme.spacing.xs }]}>Recipes</Text>
          </View>
          <Text style={[theme.typography.footnote, { color: theme.textPrimary }]} numberOfLines={2}>
            Miso soup — tap <Text style={{ fontWeight: '600', color: theme.accent }}>Add to list</Text> for ingredients
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    marginTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  overlap: {},
  mini: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.full,
  },
  segmentPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.full,
  },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.full,
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
});
