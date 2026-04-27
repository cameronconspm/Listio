import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/ThemeContext';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';
const INGREDIENTS = ['Miso paste', 'Dashi or broth', 'Tofu, cubed', 'Wakame'];

/** Saved recipe + ingredients — matches Recipes → list flow. */
export function OnboardingRecipesFeatured() {
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
        <Ionicons name="book-outline" size={18} color={theme.accent} />
        <Text style={[theme.typography.subhead, { color: theme.textPrimary, marginLeft: theme.spacing.sm, fontWeight: '600' }]}>
          Recipes
        </Text>
      </View>

      <Text style={[theme.typography.body, { color: theme.textPrimary, fontWeight: '600' }]} numberOfLines={2}>
        Miso soup
      </Text>
      <Text style={[theme.typography.caption1, { color: theme.textSecondary, marginTop: theme.spacing.xxs }]}>
        Saved in your library
      </Text>

      <View style={[styles.ingredientBlock, { marginTop: theme.spacing.md }]}>
        {INGREDIENTS.map((line, i) => (
          <Text
            key={line}
            style={[
              theme.typography.footnote,
              {
                color: theme.textSecondary,
                marginTop: i > 0 ? theme.spacing.xs : 0,
                lineHeight: 20,
              },
            ]}
          >
            · {line}
          </Text>
        ))}
      </View>

      <View style={[styles.ctaPill, { backgroundColor: theme.accent + '16', marginTop: theme.spacing.md }]}>
        <Ionicons name="add-circle-outline" size={18} color={theme.accent} />
        <Text style={[theme.typography.caption1, { color: theme.accent, fontWeight: '700', marginLeft: theme.spacing.xs }]}>
          Add to list
        </Text>
      </View>

      <Text style={[theme.typography.caption1, { color: theme.textSecondary, marginTop: theme.spacing.md, lineHeight: 19 }]}>
        Build a collection of dishes you make often. Pull what you need into Plan when you are stocking up.
      </Text>
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
    marginBottom: spacing.sm,
  },
  ingredientBlock: {},
  ctaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
});
