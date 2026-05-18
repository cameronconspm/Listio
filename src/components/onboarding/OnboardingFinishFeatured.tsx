import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useTheme } from '../../design/ThemeContext';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';
import { OnboardingStagger } from './OnboardingStagger';
import { useReduceMotion } from '../../ui/motion/useReduceMotion';
import { onboardingCelebrateEnter } from './onboardingMotion';

const NEXT_STEPS = [
  { icon: 'list' as const, label: 'List', hint: 'Add your first items in Plan' },
  { icon: 'restaurant-outline' as const, label: 'Meals', hint: 'Sketch this week’s dinners' },
  { icon: 'book-outline' as const, label: 'Recipes', hint: 'Save a dish you cook often' },
];

/** Completion hero with animated check and quick-start cards. */
export function OnboardingFinishFeatured() {
  const theme = useTheme();
  const reduced = useReduceMotion();

  return (
    <View style={styles.block}>
      <OnboardingStagger index={1}>
        <View
          style={[
            styles.hero,
            {
              backgroundColor: theme.surface,
              borderColor: theme.accent + '30',
            },
            theme.shadows.floating,
          ]}
        >
          <Text
            style={[
              theme.typography.caption1,
              {
                color: theme.accent,
                textTransform: 'uppercase',
                letterSpacing: 0.8,
                fontWeight: '700',
                marginBottom: theme.spacing.sm,
              },
            ]}
          >
            You are all set
          </Text>
          <Animated.View
            entering={onboardingCelebrateEnter(reduced)}
            style={[styles.checkCircle, { backgroundColor: theme.accent }]}
          >
            <Ionicons name="checkmark" size={32} color="#fff" accessibilityLabel="Success" />
          </Animated.View>
          <Text style={[theme.typography.title3, { color: theme.textPrimary, textAlign: 'center', marginTop: theme.spacing.md }]}>
            Ready to plan and shop
          </Text>
          <Text style={[theme.typography.subhead, { color: theme.textSecondary, textAlign: 'center', marginTop: theme.spacing.sm, lineHeight: 21 }]}>
            Your list, meal week, and recipes are connected. Tap Get started to open List.
          </Text>
        </View>
      </OnboardingStagger>

      <OnboardingStagger index={2}>
        <Text style={[theme.typography.footnote, { color: theme.textSecondary, marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm, fontWeight: '600' }]}>
          Try first
        </Text>
        <View style={styles.nextRow}>
          {NEXT_STEPS.map((step) => (
            <View
              key={step.label}
              style={[
                styles.nextCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.divider,
                },
                theme.shadows.card,
              ]}
            >
              <View style={[styles.nextIcon, { backgroundColor: theme.accent + '16' }]}>
                <Ionicons name={step.icon} size={18} color={theme.accent} />
              </View>
              <Text style={[theme.typography.caption1, { color: theme.textPrimary, fontWeight: '700', marginTop: 8 }]}>
                {step.label}
              </Text>
              <Text style={[theme.typography.caption2, { color: theme.textSecondary, marginTop: 4, lineHeight: 14, textAlign: 'center' }]}>
                {step.hint}
              </Text>
            </View>
          ))}
        </View>
      </OnboardingStagger>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {},
  hero: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    alignItems: 'center',
  },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  nextCard: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.sm,
    alignItems: 'center',
    minHeight: 100,
  },
  nextIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
