import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/ThemeContext';
import { SecondaryButton } from '../ui/SecondaryButton';
import type { DuplicateMatch } from '../../utils/duplicateDetection';
import type { ParsedItem } from '../../utils/parseItems';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';

type DuplicateResolutionPanelProps = {
  match: DuplicateMatch;
  incoming: ParsedItem;
  onMerge: () => void;
  onAddSeparately: () => void;
  onCancel: () => void;
};

/** In-sheet duplicate resolution UI (shared with former bottom-sheet variant). */
export function DuplicateResolutionPanel({
  match,
  incoming,
  onMerge,
  onAddSeparately,
  onCancel,
}: DuplicateResolutionPanelProps) {
  const theme = useTheme();
  const { existing, sameUnit, mergedQuantity, mergedUnit } = match;
  const existingQty = existing.quantity_value ?? 1;
  const existingUnit = existing.quantity_unit ?? 'ea';
  const incomingQty = incoming.quantity ?? 1;
  const incomingUnit = incoming.unit ?? 'ea';

  return (
    <View>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: theme.accent + '20' }]}>
          <Ionicons name="duplicate-outline" size={28} color={theme.accent} />
        </View>
        <Text style={[theme.typography.title3, { color: theme.textPrimary, marginTop: theme.spacing.sm }]}>
          Already on your list
        </Text>
        <Text
          style={[
            theme.typography.body,
            { color: theme.textSecondary, marginTop: theme.spacing.xs, textAlign: 'center' },
          ]}
        >
          &quot;{existing.name}&quot; is already on your list.
        </Text>
      </View>

      <View style={[styles.detail, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
        <Text style={[theme.typography.footnote, { color: theme.textSecondary }]}>
          Current: {existingQty} {existingUnit}
        </Text>
        <Text style={[theme.typography.footnote, { color: theme.textSecondary }]}>
          Adding: {incomingQty} {incomingUnit}
        </Text>
      </View>

      <View style={styles.actions}>
        {sameUnit ? (
          <Pressable
            onPress={onMerge}
            style={[styles.primaryAction, { backgroundColor: theme.accent, minHeight: 44 }]}
            accessibilityRole="button"
            accessibilityLabel={`Merge to ${mergedQuantity} ${mergedUnit ?? existingUnit}`}
          >
            <Text style={[theme.typography.headline, { color: theme.onAccent }]}>
              Merge to {mergedQuantity} {mergedUnit ?? existingUnit}
            </Text>
          </Pressable>
        ) : (
          <Text style={[theme.typography.footnote, { color: theme.textSecondary, marginBottom: theme.spacing.sm }]}>
            Different units. Merge not available
          </Text>
        )}

        <SecondaryButton title="Add as separate item" onPress={onAddSeparately} style={styles.secondary} />
        <Pressable onPress={onCancel} style={styles.cancel} accessibilityRole="button">
          <Text style={[theme.typography.subhead, { color: theme.textSecondary }]}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  actions: {
    gap: spacing.sm,
  },
  primaryAction: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: {
    marginTop: spacing.xs,
  },
  cancel: {
    minHeight: 44,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
