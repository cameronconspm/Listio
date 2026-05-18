import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../design/ThemeContext';
import { PrimaryButton } from './PrimaryButton';
import { spacing } from '../../design/spacing';

type Props = {
  message: string;
  onRetry: () => void;
  retryLabel?: string;
};

/** Full-screen friendly error when the first query load fails (no cached data). */
export function QueryLoadErrorPanel({
  message,
  onRetry,
  retryLabel = 'Try again',
}: Props) {
  const theme = useTheme();
  return (
    <View style={styles.centered}>
      <Text
        style={[
          theme.typography.body,
          styles.message,
          { color: theme.textSecondary },
        ]}
      >
        {message}
      </Text>
      <PrimaryButton title={retryLabel} onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  message: { textAlign: 'center' },
});
