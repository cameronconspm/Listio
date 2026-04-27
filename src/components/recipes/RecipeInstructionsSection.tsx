import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../design/ThemeContext';
import { parseRecipeInstructionSteps } from '../../utils/parseRecipeInstructionSteps';
import { spacing } from '../../design/spacing';

type RecipeInstructionsSectionProps = {
  instructions: string | null | undefined;
};

export function RecipeInstructionsSection({ instructions }: RecipeInstructionsSectionProps) {
  const theme = useTheme();
  const steps = parseRecipeInstructionSteps(instructions);

  if (steps.length === 0) {
    return (
      <Text style={[theme.typography.subhead, { color: theme.textSecondary }]}>
        No instructions yet. Tap Edit recipe to add step-by-step directions.
      </Text>
    );
  }

  return (
    <View style={styles.steps}>
      {steps.map((step, index) => (
        <View
          key={index}
          style={[
            styles.stepRow,
            index > 0 && { marginTop: theme.spacing.md },
          ]}
        >
          <View style={[styles.indexBadge, { backgroundColor: theme.textSecondary + '18' }]}>
            <Text style={[theme.typography.caption1, { color: theme.textPrimary, fontWeight: '600' }]}>
              {index + 1}
            </Text>
          </View>
          <Text style={[theme.typography.body, { color: theme.textPrimary, flex: 1 }]}>{step}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  steps: {
    paddingVertical: spacing.xs,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  indexBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
});
