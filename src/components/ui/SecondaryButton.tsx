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

type SecondaryButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

/** Pill-shaped secondary button: glass/neutral surface, subtle border. */
export function SecondaryButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  style,
  textStyle,
}: SecondaryButtonProps) {
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
        {
          backgroundColor: theme.surfaceGlass,
          borderWidth: 1,
          borderColor: theme.divider,
        },
        isDisabled && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={theme.textPrimary} size="small" />
      ) : (
        <Text style={[theme.typography.headline, { color: theme.textPrimary }, textStyle]}>{title}</Text>
      )}
    </PressableScale>
  );
}
