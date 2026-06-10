import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useTheme } from '../../design/ThemeContext';
import { radius } from '../../design/radius';
import { OnboardingStepHeader } from './OnboardingStepHeader';
import { OnboardingListFeatured } from './OnboardingListFeatured';
import { OnboardingMealsFeatured } from './OnboardingMealsFeatured';
import { OnboardingRecipesFeatured } from './OnboardingRecipesFeatured';
import { useReduceMotion } from '../../ui/motion/useReduceMotion';
import { onboardingPanelEnter } from './onboardingMotion';

const TABS = [
  {
    id: 'list' as const,
    label: 'List',
    icon: 'list' as const,
    headline: 'Plan, then shop from the same list',
    sentence: 'Add and organize in Plan. Flip to Shop for checkboxes and aisle-friendly sections when you are in the store.',
  },
  {
    id: 'meals' as const,
    label: 'Meals',
    icon: 'restaurant-outline' as const,
    headline: 'See your week at a glance',
    sentence: 'Lay out breakfasts, lunches, and dinners across the week, then send what you need straight into your list.',
  },
  {
    id: 'recipes' as const,
    label: 'Recipes',
    icon: 'book-outline' as const,
    headline: 'Cook it again without retyping',
    sentence: 'Save dishes you make often. Pull every ingredient into Plan with one tap when you are stocking up.',
  },
];

function TabPreviewPanel({ tabId }: { tabId: (typeof TABS)[number]['id'] }) {
  if (tabId === 'list') return <OnboardingListFeatured />;
  if (tabId === 'meals') return <OnboardingMealsFeatured />;
  return <OnboardingRecipesFeatured />;
}

/** Tab orientation with rich in-app previews and animated panel swaps. */
export function OnboardingTabsOrientation() {
  const theme = useTheme();
  const reduced = useReduceMotion();
  const [page, setPage] = useState(0);
  const active = TABS[page] ?? TABS[0];

  const goPage = useCallback((i: number) => {
    setPage(Math.max(0, Math.min(TABS.length - 1, i)));
  }, []);

  return (
    <View>
      <OnboardingStepHeader
        eyebrow="How Listio works"
        title="Three tabs, one connected flow"
        subtitle="Everything you plan, cook, and buy stays linked to your list."
      />

      <View style={[styles.segmentRow, { marginBottom: theme.spacing.md }]}>
        {TABS.map((t, i) => {
          const isActive = i === page;
          return (
            <Pressable
              key={t.id}
              onPress={() => goPage(i)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              style={[
                styles.segment,
                i > 0 ? { marginLeft: 8 } : null,
                {
                  borderColor: isActive ? theme.accent : theme.divider,
                  backgroundColor: isActive ? theme.accent + '20' : theme.surface,
                },
                isActive ? theme.shadows.elevated : null,
              ]}
            >
              <Ionicons name={t.icon} size={16} color={isActive ? theme.accent : theme.textSecondary} />
              <Text
                style={[
                  theme.typography.subhead,
                  {
                    fontWeight: isActive ? '700' : '500',
                    color: isActive ? theme.accent : theme.textSecondary,
                    marginLeft: 6,
                  },
                ]}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View
        style={[
          styles.headlineCard,
          {
            backgroundColor: theme.accent + '12',
            borderColor: theme.accent + '28',
          },
        ]}
      >
        <Text style={[theme.typography.subhead, { color: theme.textPrimary, fontWeight: '700', marginBottom: 4 }]}>
          {active.headline}
        </Text>
        <Text style={[theme.typography.footnote, { color: theme.textSecondary, lineHeight: 19 }]}>{active.sentence}</Text>
      </View>

      <Animated.View key={active.id} entering={onboardingPanelEnter(reduced)} style={{ marginTop: theme.spacing.md }}>
        <TabPreviewPanel tabId={active.id} />
      </Animated.View>

      <View style={[styles.dots, { marginTop: theme.spacing.lg }]}>
        {TABS.map((t, i) => (
          <Pressable
            key={t.id}
            onPress={() => goPage(i)}
            accessibilityRole="button"
            accessibilityLabel={`Go to ${t.label}`}
            hitSlop={8}
            style={[
              styles.dot,
              i > 0 ? { marginLeft: 6 } : null,
              {
                backgroundColor: i === page ? theme.accent : theme.divider,
                width: i === page ? 22 : 6,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  segmentRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  segment: {
    flexDirection: 'row',
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headlineCard: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
});
