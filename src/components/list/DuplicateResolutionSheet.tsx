import React, { useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/ThemeContext';
import { BottomSheet } from '../ui/BottomSheet';
import { SecondaryButton } from '../ui/SecondaryButton';
import type { DuplicateMatch } from '../../utils/duplicateDetection';
import type { ParsedItem } from '../../utils/parseItems';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';

type DuplicateResolutionSheetProps = {
  visible: boolean;
  match: DuplicateMatch | null;
  incoming: ParsedItem | null;
  onMerge: () => void;
  onAddSeparately: () => void;
  onCancel: () => void;
};

export function DuplicateResolutionSheet({
  visible,
  match,
  incoming,
  onMerge,
  onAddSeparately,
  onCancel,
}: DuplicateResolutionSheetProps) {
  const theme = useTheme();

  // Keep last payload while the sheet finishes its exit animation (visible=false). Do not gate on
  // `visible` — that unmounts BottomSheet immediately and skips the dismiss animation.
  const matchRef = useRef<DuplicateMatch | null>(null);
  const incomingRef = useRef<ParsedItem | null>(null);
  if (match) matchRef.current = match;
  if (incoming) incomingRef.current = incoming;
  const effectiveMatch = match ?? matchRef.current;
  const effectiveIncoming = incoming ?? incomingRef.current;

  if (!effectiveMatch || !effectiveIncoming) return null;

  const { existing, sameUnit, mergedQuantity, mergedUnit } = effectiveMatch;
  const existingQty = existing.quantity_value ?? 1;
  const existingUnit = existing.quantity_unit ?? 'ea';
  const incomingQty = effectiveIncoming.quantity ?? 1;
  const incomingUnit = effectiveIncoming.unit ?? 'ea';

  return (
    <BottomSheet visible={visible} onClose={onCancel}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: theme.accent + '20' }]}>
          <Ionicons name="duplicate-outline" size={28} color={theme.accent} />
        </View>
        <Text style={[theme.typography.title3, { color: theme.textPrimary, marginTop: theme.spacing.sm }]}>
          Already on your list
        </Text>
        <Text style={[theme.typography.body, { color: theme.textSecondary, marginTop: theme.spacing.xs, textAlign: 'center' }]}>
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
            style={[styles.primaryAction, { backgroundColor: theme.accent }]}
          >
            <Text style={[theme.typography.headline, { color: theme.onAccent }]}>
              Merge to {mergedQuantity} {mergedUnit ?? existingUnit}
            </Text>
          </Pressable>
        ) : (
          <Text style={[theme.typography.footnote, { color: theme.textSecondary, marginBottom: theme.spacing.sm }]}>
            Different units — merge not available
          </Text>
        )}

        <SecondaryButton
          title="Add as separate item"
          onPress={onAddSeparately}
          style={styles.secondary}
        />
        <Pressable onPress={onCancel} style={styles.cancel}>
          <Text style={[theme.typography.subhead, { color: theme.textSecondary }]}>Cancel</Text>
        </Pressable>
      </View>
    </BottomSheet>
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
  },
  secondary: {
    marginTop: spacing.xs,
  },
  cancel: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
});
