import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../design/ThemeContext';
import { RecipePill } from './RecipePill';

type RecipeMetaPillsProps = {
  labels: string[];
};

export function RecipeMetaPills({ labels }: RecipeMetaPillsProps) {
  const theme = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
          alignItems: 'center',
        },
      }),
    [theme],
  );

  const filtered = labels.filter(Boolean);
  if (filtered.length === 0) return null;
  return (
    <View style={styles.row}>
      {filtered.map((label, i) => (
        <RecipePill key={`${label}-${i}`} label={label} />
      ))}
    </View>
  );
}
