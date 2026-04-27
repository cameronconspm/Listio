import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../../design/ThemeContext';
import { BottomSheet } from './BottomSheet';
import { spacing } from '../../design/spacing';

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  style?: ViewStyle;
  /** When true, drag down on the grabber to dismiss. */
  interactiveDismiss?: boolean;
};

/**
 * Alternate bottom sheet shell (non-glass opaque surface).
 * Routes through BottomSheet so all sheet motion and dismissal semantics stay unified.
 */
export function Sheet({
  visible,
  onClose,
  children,
  title,
  style,
  interactiveDismiss = true,
}: SheetProps) {
  const theme = useTheme();

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      interactiveDismiss={interactiveDismiss}
      surfaceVariant="solid"
      presentationVariant="passive"
    >
      {title ? (
        <Text style={[theme.typography.headline, { color: theme.textPrimary, paddingHorizontal: theme.spacing.md }]}>
          {title}
        </Text>
      ) : null}
      <View style={[styles.content, title && { paddingTop: theme.spacing.sm }, style]}>{children}</View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xl,
  },
});
