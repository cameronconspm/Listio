import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/ThemeContext';
import { horizontalScrollInsetBleed } from '../../design/layout';
import { useHaptics } from '../../hooks/useHaptics';
import type { RecipeFilter } from '../../services/recipeService';

const FILTER_OPTIONS: { key: RecipeFilter; label: string; icon?: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'All' },
  { key: 'favorites', label: 'Favorites', icon: 'heart' },
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'dessert', label: 'Dessert' },
  { key: 'snack', label: 'Snack' },
  { key: 'recent', label: 'Recent', icon: 'time' },
];

type RecipeFilterRowProps = {
  filter: RecipeFilter;
  onFilterChange: (filter: RecipeFilter) => void;
};

/**
 * Horizontally scrollable pill filter row for Recipes.
 * Matches List tab chip gutter (`theme.spacing.md` + horizontal bleed).
 * Pills are one-line only, never vertically stretched.
 */
export function RecipeFilterRow({ filter, onFilterChange }: RecipeFilterRowProps) {
  const theme = useTheme();
  const haptics = useHaptics();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          alignSelf: 'stretch',
        },
        wrap: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.xs,
          paddingHorizontal: theme.spacing.md,
        },
        chip: {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'center',
          paddingVertical: 6,
          paddingHorizontal: theme.spacing.sm,
          borderRadius: 9999,
          minHeight: 0,
        },
        chipIcon: {
          marginRight: theme.spacing.xs,
        },
      }),
    [theme],
  );

  return (
    <View style={styles.container}>
      <View style={horizontalScrollInsetBleed(theme.spacing.md)}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.wrap}
        >
          {FILTER_OPTIONS.map((opt) => {
            const selected = filter === opt.key;
            const chipBg = selected ? theme.accent + '25' : theme.divider + '30';
            const textColor = selected ? theme.textPrimary : theme.textSecondary;

            return (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.chip,
                  { backgroundColor: chipBg, borderWidth: 1, borderColor: selected ? theme.accent + '60' : 'transparent' },
                ]}
                onPress={() => {
                  haptics.light();
                  onFilterChange(opt.key);
                }}
                activeOpacity={0.7}
              >
                {opt.icon ? (
                  <Ionicons name={opt.icon} size={14} color={selected ? theme.accent : theme.textSecondary} style={styles.chipIcon} />
                ) : null}
                <Text style={[theme.typography.footnote, { color: textColor }]} numberOfLines={1}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}
