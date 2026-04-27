import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../design/ThemeContext';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';
type RecipePillProps = {
  label: string;
};

/** Compact metadata chip (time, servings, etc.) aligned with recipe card designs. */
export function RecipePill({ label }: RecipePillProps) {
  const theme = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: theme.textSecondary + '16' }]}>
      <Text style={[theme.typography.caption1, { color: theme.textPrimary }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
    maxWidth: '100%',
  },
});
