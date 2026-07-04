import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useTheme } from '../../design/ThemeContext';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';
import { OnboardingStagger } from './OnboardingStagger';
import { OnboardingValueChip } from './OnboardingValueChip';
import { AppText } from '../ui/AppText';

type PreviewCard = {
  icon: keyof typeof Ionicons.glyphMap;
  tab: string;
  valueChip: string;
  highlight: React.ReactNode;
  detail: string;
  zIndex: number;
  marginBottom: number;
};

/** Animated stacked previews — List, Meals, Recipes with value chips. */
export function OnboardingWelcomeFeatured() {
  const theme = useTheme();
  const useFlatStack = theme.isLargeAccessibilityText;

  const cards: PreviewCard[] = useMemo(
    () => [
      {
        icon: 'list',
        tab: 'List',
        valueChip: 'Plan → Shop',
        zIndex: 3,
        marginBottom: useFlatStack ? 0 : -18,
        highlight: (
          <>
            <View style={[styles.segment, { backgroundColor: theme.background }]}>
              <View style={[styles.segmentPill, { backgroundColor: theme.surface }, theme.shadows.floating]}>
                <AppText variant="decorative" style={[theme.typography.caption2, { color: theme.accent, fontWeight: '700' }]}>
                  Plan
                </AppText>
              </View>
              <AppText
                variant="decorative"
                style={[theme.typography.caption2, { color: theme.textSecondary, fontWeight: '600', marginLeft: theme.spacing.sm }]}
              >
                Shop
              </AppText>
            </View>
            <View style={[styles.pill, { backgroundColor: theme.accent + '18', marginTop: theme.spacing.sm }]}>
              <AppText variant="decorative" style={[theme.typography.caption2, { color: theme.accent, fontWeight: '600' }]}>
                Produce · 9 left
              </AppText>
            </View>
            <AppText
              variant="decorative"
              style={[theme.typography.footnote, { color: theme.textPrimary, marginTop: theme.spacing.sm, fontWeight: '600' }]}
            >
              Kale · 2 bunches
            </AppText>
            <AppText
              variant="decorative"
              style={[theme.typography.caption1, { color: theme.textSecondary, marginTop: theme.spacing.xxs }]}
            >
              Bananas · 5
            </AppText>
          </>
        ),
        detail: 'One list for planning and checking off in the store.',
      },
      {
        icon: 'restaurant-outline',
        tab: 'Meals',
        valueChip: 'Week at a glance',
        zIndex: 2,
        marginBottom: useFlatStack ? 0 : -18,
        highlight: (
          <>
            <View style={styles.mealRow}>
              <View style={[styles.dot, { backgroundColor: theme.accent }]} />
              <AppText variant="decorative" style={[theme.typography.footnote, { color: theme.textPrimary, flex: 1 }]} numberOfLines={1}>
                Tue · Sheet-pan salmon
              </AppText>
            </View>
            <View style={[styles.mealRow, { marginTop: theme.spacing.xs }]}>
              <View style={[styles.dot, { backgroundColor: theme.textSecondary + '55' }]} />
              <AppText
                variant="decorative"
                style={[theme.typography.caption1, { color: theme.textSecondary, flex: 1 }]}
                numberOfLines={1}
              >
                Wed · Pasta night
              </AppText>
            </View>
          </>
        ),
        detail: 'Sketch the week, then send ingredients to your list.',
      },
      {
        icon: 'book-outline',
        tab: 'Recipes',
        valueChip: 'No retyping',
        zIndex: 1,
        marginBottom: 0,
        highlight: (
          <AppText variant="decorative" style={[theme.typography.footnote, { color: theme.textPrimary }]} numberOfLines={2}>
            Miso soup: tap <AppText style={{ fontWeight: '700', color: theme.accent }}>Add to list</AppText> for every ingredient
          </AppText>
        ),
        detail: 'Save dishes you cook often and pull them into Plan in one tap.',
      },
    ],
    [theme, useFlatStack],
  );

  return (
    <View style={[styles.stack, useFlatStack && styles.stackFlat]}>
      {cards.map((card, i) => (
        <OnboardingStagger key={card.tab} index={i + 1}>
          <View
            style={{
              marginBottom: useFlatStack ? theme.spacing.sm : card.marginBottom,
              zIndex: useFlatStack ? 0 : card.zIndex,
            }}
          >
            <View
              style={[
                styles.mini,
                {
                  backgroundColor: theme.surface,
                  borderColor: card.zIndex === 3 ? theme.accent + '35' : theme.divider,
                },
                card.zIndex === 3 ? theme.shadows.floating : card.zIndex === 2 ? theme.shadows.elevated : theme.shadows.card,
              ]}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardHeader}>
                  <View style={[styles.iconBadge, { backgroundColor: theme.accent + '18' }]}>
                    <Ionicons name={card.icon} size={16} color={theme.accent} />
                  </View>
                  <AppText
                    variant="decorative"
                    style={[theme.typography.subhead, { color: theme.textPrimary, fontWeight: '700', marginLeft: theme.spacing.sm }]}
                  >
                    {card.tab}
                  </AppText>
                </View>
                <OnboardingValueChip icon="sparkles" label={card.valueChip} />
              </View>
              {card.highlight}
              {!useFlatStack ? (
                <AppText
                  variant="decorative"
                  style={[theme.typography.caption1, { color: theme.textSecondary, marginTop: theme.spacing.sm }]}
                >
                  {card.detail}
                </AppText>
              ) : null}
            </View>
          </View>
        </OnboardingStagger>
      ))}
      <OnboardingStagger index={4}>
        <View style={[styles.flowHint, { borderColor: theme.divider, backgroundColor: theme.accent + '0c' }]}>
          <Ionicons name="git-merge-outline" size={16} color={theme.accent} />
          <AppText
            variant="decorative"
            style={[theme.typography.caption1, { color: theme.textSecondary, marginLeft: theme.spacing.sm, flex: 1 }]}
          >
            Recipes and meals feed the same list, so you never copy ingredients twice.
          </AppText>
        </View>
      </OnboardingStagger>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    marginTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  stackFlat: {
    paddingBottom: spacing.sm,
  },
  mini: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.full,
  },
  segmentPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.full,
  },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.full,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.sm,
  },
  flowHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
