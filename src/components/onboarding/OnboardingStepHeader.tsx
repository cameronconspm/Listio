import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTheme } from '../../design/ThemeContext';
import { useReduceMotion } from '../../ui/motion/useReduceMotion';
import { onboardingItemEnter } from './onboardingMotion';

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Center-align title and subtitle (tab orientation step). */
  centered?: boolean;
};

export function OnboardingStepHeader({ eyebrow, title, subtitle, centered = false }: Props) {
  const theme = useTheme();
  const reduced = useReduceMotion();
  const align = centered ? 'center' : ('left' as const);

  return (
    <Animated.View entering={onboardingItemEnter(reduced, 0)} style={styles.wrap}>
      {eyebrow ? (
        <View style={[styles.eyebrowRow, centered && styles.centeredRow]}>
          <View style={[styles.eyebrowDot, { backgroundColor: theme.accent }]} />
          <Text style={[theme.typography.caption1, styles.eyebrow, { color: theme.accent }]}>{eyebrow}</Text>
        </View>
      ) : null}
      <Text
        style={[
          theme.typography.title2,
          {
            color: theme.textPrimary,
            textAlign: align,
            marginBottom: subtitle ? theme.spacing.sm : 0,
          },
        ]}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={[
            theme.typography.body,
            {
              color: theme.textSecondary,
              lineHeight: 24,
              textAlign: align,
            },
          ]}
        >
          {subtitle}
        </Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 20,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  centeredRow: {
    justifyContent: 'center',
  },
  eyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  eyebrow: {
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
