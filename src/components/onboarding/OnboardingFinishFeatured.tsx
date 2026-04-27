import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/ThemeContext';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';
const NEXT_STEPS = [
  { icon: 'list' as const, title: 'List: Plan and Shop', subtitle: 'Build and edit in Plan. Check off by section when you are shopping.' },
  { icon: 'restaurant-outline' as const, title: 'Meals', subtitle: 'Lay out the week, then send what you need to your list.' },
  { icon: 'book-outline' as const, title: 'Recipes', subtitle: 'Keep favorites handy and pull ingredients into your list in one tap.' },
];

/** Completion hero + next steps aligned to main tabs. */
export function OnboardingFinishFeatured() {
  const theme = useTheme();

  return (
    <View style={styles.block}>
      <View
        style={[
          styles.hero,
          { marginBottom: theme.spacing.lg },
          {
            backgroundColor: theme.surface,
            borderColor: theme.divider,
          },
          theme.shadows.elevated,
        ]}
      >
        <Text
          style={[
            theme.typography.caption1,
            {
              color: theme.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              marginBottom: theme.spacing.sm,
            },
          ]}
        >
          Setup complete
        </Text>
        <View style={[styles.checkCircle, { backgroundColor: theme.accent + '20' }]}>
          <Ionicons name="checkmark" size={28} color={theme.accent} accessibilityLabel="Success" />
        </View>
        <Text style={[theme.typography.title3, { color: theme.textPrimary, textAlign: 'center', marginTop: theme.spacing.md }]}>
          You are ready to plan and shop
        </Text>
        <Text style={[theme.typography.subhead, { color: theme.textSecondary, textAlign: 'center', marginTop: theme.spacing.sm, lineHeight: 21 }]}>
          The bottom tabs keep you in List, Meals, and Recipes. Tap Get started to jump in.
        </Text>
      </View>

      <View
        style={[
          styles.listCard,
          {
            backgroundColor: theme.surface,
            borderColor: theme.divider,
          },
          theme.shadows.card,
        ]}
      >
        <Text style={[theme.typography.caption1, { color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: theme.spacing.sm }]}>
          Where to start
        </Text>
        {NEXT_STEPS.map((row, i) => (
          <View
            key={row.title}
            style={[
              styles.row,
              i > 0 && { borderTopColor: theme.divider, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: theme.spacing.md, marginTop: theme.spacing.md },
            ]}
          >
            <View style={[styles.iconCell, { backgroundColor: theme.accent + '12' }]}>
              <Ionicons name={row.icon} size={18} color={theme.accent} />
            </View>
            <View style={styles.rowText}>
              <Text style={[theme.typography.body, { color: theme.textPrimary, fontWeight: '600' }]}>{row.title}</Text>
              <Text style={[theme.typography.footnote, { color: theme.textSecondary, marginTop: theme.spacing.xxs, lineHeight: 18 }]}>
                {row.subtitle}
              </Text>
            </View>
          </View>
        ))}
      </View>
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
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listCard: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconCell: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    marginLeft: spacing.md,
    minWidth: 0,
  },
});
