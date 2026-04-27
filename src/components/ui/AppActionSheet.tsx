import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../../design/ThemeContext';
import { BottomSheet } from './BottomSheet';
import { spacing } from '../../design/spacing';

export type AppActionSheetAction = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

type AppActionSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  actions: AppActionSheetAction[];
};

/**
 * Bottom sheet for action menus: list actions, store selection, non-destructive choices.
 * Uses same BottomSheet, backdrop, and list styling as ListActionsSheet.
 */
export function AppActionSheet({ visible, onClose, title, message, actions }: AppActionSheetProps) {
  const theme = useTheme();

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      surfaceVariant="solid"
      presentationVariant="action"
      testID="app-action-sheet"
    >
      {(title || message) && (
        <View style={styles.header}>
          {title && (
            <Text style={[theme.typography.headline, { color: theme.textPrimary }]}>{title}</Text>
          )}
          {message && (
            <Text style={[theme.typography.body, { color: theme.textSecondary, marginTop: theme.spacing.xs }]}>
              {message}
            </Text>
          )}
        </View>
      )}
      <View style={[styles.actions, { backgroundColor: theme.surface, borderRadius: theme.radius.md }]}>
        {actions.map((action, i) => (
          <React.Fragment key={action.label}>
            {i > 0 && <View style={[styles.divider, { backgroundColor: theme.divider }]} />}
            <Pressable
              onPress={() => {
                onClose();
                action.onPress();
              }}
              style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel={action.label}
            >
              <Text
                style={[
                  theme.typography.body,
                  { flex: 1, color: action.destructive ? theme.danger : theme.textPrimary },
                ]}
              >
                {action.label}
              </Text>
            </Pressable>
          </React.Fragment>
        ))}
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
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  divider: {
    height: 1,
    marginHorizontal: spacing.md,
  },
});
