import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/ThemeContext';
import { spacing } from '../../design/spacing';
const ITEMS = [
  { icon: 'list' as const, label: 'List' },
  { icon: 'restaurant-outline' as const, label: 'Meals' },
  { icon: 'book-outline' as const, label: 'Recipes' },
];

/** Compact sign-in context—distinct from onboarding’s stacked preview cards. */
export function SignInValueStrip() {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {ITEMS.map(({ icon, label }) => (
        <View
          key={label}
          style={styles.cell}
          accessible
          accessibilityRole="text"
          accessibilityLabel={label}
        >
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: theme.accent + '1A',
              },
            ]}
          >
            <Ionicons name={icon} size={22} color={theme.accent} />
          </View>
          <Text style={[theme.typography.caption1, { color: theme.textSecondary, marginTop: theme.spacing.xs }]}>
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    minWidth: 72,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
