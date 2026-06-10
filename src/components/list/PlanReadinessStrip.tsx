import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../design/ThemeContext';
import { Mascot, type MascotMood } from '../brand/Mascot';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';

type Props = {
  totalItems: number;
  linkedItemCount: number;
};

type ReadinessState = {
  mood: MascotMood;
  title: string;
  subtitle: string;
};

function getReadinessState(totalItems: number, linkedItemCount: number): ReadinessState {
  if (totalItems === 0) {
    return {
      mood: 'empty',
      title: 'Your list is empty',
      subtitle: 'Add items below or plan some meals to get started.',
    };
  }
  if (totalItems < 6) {
    return {
      mood: 'empty',
      title: 'Just getting started',
      subtitle: 'A few more items and you\'ll be set for the week.',
    };
  }
  if (linkedItemCount === 0 && totalItems < 15) {
    return {
      mood: 'hero',
      title: 'List is coming together',
      subtitle: 'Link meals to connect items to your weekly plan.',
    };
  }
  if (linkedItemCount > 0 && totalItems >= 15) {
    return {
      mood: 'celebrate',
      title: 'Well stocked for the week',
      subtitle: `${linkedItemCount} item${linkedItemCount === 1 ? '' : 's'} tied to your meal plan.`,
    };
  }
  if (linkedItemCount > 0) {
    return {
      mood: 'hero',
      title: 'Looking good',
      subtitle: `${linkedItemCount} item${linkedItemCount === 1 ? '' : 's'} linked to meals.`,
    };
  }
  return {
    mood: 'hero',
    title: 'Ready to plan',
    subtitle: 'Tap Meals to link items to your weekly schedule.',
  };
}

export function PlanReadinessStrip({ totalItems, linkedItemCount }: Props) {
  const theme = useTheme();
  const { mood, title, subtitle } = useMemo(
    () => getReadinessState(totalItems, linkedItemCount),
    [totalItems, linkedItemCount]
  );

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.surfaceRaised,
          borderColor: theme.divider,
        },
      ]}
      accessible
      accessibilityLabel={`${title}. ${subtitle}`}
    >
      <Mascot mood={mood} size={54} />
      <View style={styles.copy}>
        <Text
          style={[theme.typography.subhead, { color: theme.textPrimary, fontWeight: '600' }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          style={[theme.typography.footnote, { color: theme.textSecondary, marginTop: 2 }]}
          numberOfLines={2}
        >
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  copy: {
    flex: 1,
  },
});
