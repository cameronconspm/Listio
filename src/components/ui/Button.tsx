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

type ButtonVariant = 'primary' | 'secondary' | 'tertiary';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle,
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        base: {
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          minHeight: 44,
          justifyContent: 'center',
          alignItems: 'center',
        },
      }),
    [theme],
  );

  const bgStyle: ViewStyle =
    variant === 'primary'
      ? { backgroundColor: theme.accent }
      : variant === 'secondary'
        ? { backgroundColor: theme.surfaceGlass, borderWidth: 1, borderColor: theme.divider }
        : { backgroundColor: 'transparent' };

  const textColor =
    variant === 'primary'
      ? theme.onAccent
      : variant === 'secondary'
        ? theme.textPrimary
        : theme.accent;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.base,
        { borderRadius: theme.radius.md },
        bgStyle,
        isDisabled && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? theme.onAccent : theme.accent} size="small" />
      ) : (
        <Text style={[theme.typography.headline, { color: textColor }, textStyle]}>{title}</Text>
      )}
    </PressableScale>
  );
}
