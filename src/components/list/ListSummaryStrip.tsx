import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/ThemeContext';
import { ZONE_LABELS } from '../../data/zone';
import type { ZoneKey } from '../../types/models';
import type { ShoppingMode } from '../../hooks/useShoppingMode';
import { HeaderIconButton } from '../ui/HeaderIconButton';
import { spacing } from '../../design/spacing';

const MIN_TOUCH = 44;

type ListSummaryStripProps = {
  mode: ShoppingMode;
  /** Plan mode */
  totalItems: number;
  zoneCount: number;
  /** Shop mode */
  itemsLeft: number;
  sectionsLeft: number;
  nextSection: ZoneKey | null;
  onListActionsPress?: () => void;
  /** When set, replaces the ⋯ control with Cancel / Done (section reorder). */
  reorderToolbar?: {
    onCancel: () => void;
    onDone: () => void;
  } | null;
};

export function ListSummaryStrip({
  mode,
  totalItems,
  zoneCount,
  itemsLeft,
  sectionsLeft,
  nextSection,
  onListActionsPress,
  reorderToolbar = null,
}: ListSummaryStripProps) {
  const theme = useTheme();

  const trailingControls = reorderToolbar ? (
    <View style={styles.reorderActions}>
      <Pressable
        onPress={reorderToolbar.onCancel}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Cancel reordering"
        style={({ pressed }) => [styles.reorderHit, pressed && { opacity: 0.65 }]}
      >
        <Text style={[theme.typography.body, { color: theme.textSecondary }]}>Cancel</Text>
      </Pressable>
      <Pressable
        onPress={reorderToolbar.onDone}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Done reordering"
        style={({ pressed }) => [styles.reorderHit, pressed && { opacity: 0.65 }]}
      >
        <Text style={[theme.typography.subhead, { color: theme.accent, fontWeight: '600' }]}>Done</Text>
      </Pressable>
    </View>
  ) : onListActionsPress ? (
    <HeaderIconButton accessibilityLabel="List actions" onPress={onListActionsPress} hitSlop={8}>
      <Ionicons name="ellipsis-horizontal" size={22} color={theme.textSecondary} />
    </HeaderIconButton>
  ) : null;

  if (mode === 'plan') {
    return (
      <View style={styles.container}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryTextWrap}>
            <View style={styles.textRow}>
              <Text style={[theme.typography.footnote, { color: theme.textSecondary }]}>
                {totalItems === 0 ? 'No items' : `${totalItems} ${totalItems === 1 ? 'item' : 'items'}`}
              </Text>
              {totalItems > 0 ? (
                <>
                  <Text style={[theme.typography.footnote, { color: theme.textSecondary }]}> · </Text>
                  <Text style={[theme.typography.footnote, { color: theme.textSecondary }]}>
                    {zoneCount} {zoneCount === 1 ? 'section' : 'sections'}
                  </Text>
                </>
              ) : null}
            </View>
          </View>
          {trailingControls}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.summaryRow}>
        <View style={styles.summaryTextWrap}>
          <View style={styles.textRow}>
            <Text style={[theme.typography.subhead, { color: theme.textPrimary }]}>
              {itemsLeft} left
            </Text>
            <Text style={[theme.typography.footnote, { color: theme.textSecondary }]}>
              {' '}
              · {sectionsLeft} {sectionsLeft === 1 ? 'section' : 'sections'}
            </Text>
            {nextSection && (
              <>
                <Text style={[theme.typography.footnote, { color: theme.textSecondary }]}>
                  {' '}
                  · Next:
                </Text>
                <Text style={[theme.typography.footnote, { color: theme.accent, marginLeft: theme.spacing.xxs }]}>
                  {ZONE_LABELS[nextSection]}
                </Text>
              </>
            )}
          </View>
        </View>
        {trailingControls}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    /** Sits directly under zone chips; keep minimal gap (chips row has its own top inset). */
    paddingTop: 0,
    paddingBottom: spacing.xs,
    paddingHorizontal: 0,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  summaryTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  textRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  reorderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
  },
  reorderHit: {
    minHeight: MIN_TOUCH,
    minWidth: MIN_TOUCH,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
});
