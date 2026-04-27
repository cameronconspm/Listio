import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/ThemeContext';
import { BottomSheet } from '../ui/BottomSheet';
import { spacing } from '../../design/spacing';

type ListActionsSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Fires after the sheet’s dismiss animation finishes (native modal exit). Use to present another modal. */
  onDismissed?: () => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  onReorderSections: () => void;
  onDeleteEntireList: () => void;
};

export function ListActionsSheet({
  visible,
  onClose,
  onDismissed,
  onCollapseAll,
  onExpandAll,
  onReorderSections,
  onDeleteEntireList,
}: ListActionsSheetProps) {
  const theme = useTheme();

  const handleCollapse = () => {
    onClose();
    onCollapseAll();
  };

  const handleExpand = () => {
    onClose();
    onExpandAll();
  };

  const handleReorder = () => {
    onClose();
    onReorderSections();
  };

  /** Parent closes the sheet and shows the confirm dialog from `onDismissed` (avoid stacking modals mid-dismiss). */
  const handleDeleteEntireList = () => {
    onDeleteEntireList();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onDismissed={onDismissed}
      surfaceVariant="solid"
      presentationVariant="action"
    >
      <View style={styles.header}>
        <Text style={[theme.typography.headline, { color: theme.textPrimary }]}>List actions</Text>
      </View>
      <View style={[styles.actions, { backgroundColor: theme.surface, borderRadius: theme.radius.card }]}>
        <Pressable
          onPress={handleReorder}
          style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="reorder-three" size={22} color={theme.textSecondary} />
          <Text style={[theme.typography.body, { color: theme.textPrimary, flex: 1 }]}>Reorder sections</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </Pressable>
        <View style={[styles.divider, { backgroundColor: theme.divider }]} />
        <Pressable
          onPress={handleCollapse}
          style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="chevron-up" size={22} color={theme.textSecondary} />
          <Text style={[theme.typography.body, { color: theme.textPrimary, flex: 1 }]}>Collapse all</Text>
        </Pressable>
        <View style={[styles.divider, { backgroundColor: theme.divider }]} />
        <Pressable
          onPress={handleExpand}
          style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="chevron-down" size={22} color={theme.textSecondary} />
          <Text style={[theme.typography.body, { color: theme.textPrimary, flex: 1 }]}>Expand all</Text>
        </Pressable>
        <View style={[styles.divider, { backgroundColor: theme.divider }]} />
        <Pressable
          onPress={handleDeleteEntireList}
          style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel="Delete entire list"
        >
          <Ionicons name="trash-outline" size={22} color={theme.danger} />
          <Text style={[theme.typography.body, { color: theme.danger, flex: 1 }]}>Delete entire list</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.lg,
  },
  actions: {
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  divider: {
    height: 1,
  },
});
