import React, { useMemo } from 'react';
import {
  Text,
  StyleSheet,
  ActivityIndicator,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useTheme } from '../../design/ThemeContext';
import { PressableScale } from './PressableScale';

type PrimaryButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Slightly shorter control (~50pt) for toolbars / keyboard-adjacent CTAs. */
  size?: 'default' | 'compact';
  /** No shadow — use inside bottom sheets for a flatter, cleaner CTA. */
  flat?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

/** Pill-shaped primary CTA with accent fill and subtle elevation. */
export function PrimaryButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  size = 'default',
  flat = false,
  style,
  textStyle,
}: PrimaryButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        base: {
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          minHeight: 44,
          borderRadius: theme.radius.full,
          justifyContent: 'center',
          alignItems: 'center',
        },
        compact: {
          paddingVertical: 8,
          paddingHorizontal: theme.spacing.md,
          minHeight: 50,
        },
      }),
    [theme],
  );

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.base,
        size === 'compact' && styles.compact,
        { backgroundColor: theme.accent },
        !flat && theme.shadows.sm,
        isDisabled && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={theme.onAccent} size="small" />
      ) : (
        <Text style={[theme.typography.headline, { color: theme.onAccent }, textStyle]}>{title}</Text>
      )}
    </PressableScale>
  );
}
