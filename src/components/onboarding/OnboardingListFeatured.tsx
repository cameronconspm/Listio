import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/ThemeContext';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';
const MOCK_SECTIONS = [
  { label: 'Produce', sample: 'Kale · 2 bunches' },
  { label: 'Dairy', sample: 'Milk 1 gal, Greek yogurt' },
];

/** Plan / Shop + section-grouped list — matches List tab without naming other tabs. */
export function OnboardingListFeatured() {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: theme.surface,
          borderColor: theme.divider,
        },
        theme.shadows.card,
      ]}
    >
      <View style={styles.mockHeader}>
        <Ionicons name="list" size={18} color={theme.accent} />
        <Text style={[theme.typography.subhead, { color: theme.textPrimary, marginLeft: theme.spacing.sm, fontWeight: '600' }]}>
          List
        </Text>
      </View>

      <View style={[styles.segment, { backgroundColor: theme.background }]}>
        <View style={[styles.segmentPill, { backgroundColor: theme.surface }, theme.shadows.floating]}>
          <Text style={[theme.typography.caption1, { color: theme.accent, fontWeight: '700' }]}>Plan</Text>
        </View>
        <Text style={[theme.typography.caption1, { color: theme.textSecondary, fontWeight: '600', marginLeft: theme.spacing.md }]}>
          Shop
        </Text>
      </View>

      <Text style={[theme.typography.caption1, { color: theme.textSecondary, marginBottom: theme.spacing.md, marginTop: theme.spacing.md, lineHeight: 19 }]}>
        In Shop, items show checkboxes and what is left per section. In Plan, you add and edit without the trip-day noise.
      </Text>

      {MOCK_SECTIONS.map((a, i) => (
        <View
          key={a.label}
          style={[
            styles.sectionRow,
            i > 0 && { borderTopColor: theme.divider, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: theme.spacing.sm, marginTop: theme.spacing.sm },
          ]}
        >
          <View style={[styles.zoneTag, { backgroundColor: theme.accent + '14' }]}>
            <Text style={[theme.typography.caption1, { color: theme.accent, fontWeight: '600' }]}>{a.label}</Text>
          </View>
          <Text style={[theme.typography.footnote, { color: theme.textSecondary, marginTop: theme.spacing.xs }]}>{a.sample}</Text>
        </View>
      ))}

      <View style={[styles.qtyRow, { marginTop: theme.spacing.md, borderTopColor: theme.divider, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: theme.spacing.md }]}>
        <Ionicons name="git-branch-outline" size={16} color={theme.textSecondary} />
        <Text style={[theme.typography.caption1, { color: theme.textSecondary, marginLeft: theme.spacing.sm, flex: 1 }]}>
          Your list groups by section so the order matches how you move through the store.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
  },
  mockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxs,
    borderRadius: radius.full,
  },
  sectionRow: {},
  zoneTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.sm,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
});
