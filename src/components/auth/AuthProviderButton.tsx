import React, { useMemo } from 'react';
import { Text, StyleSheet, ActivityIndicator, type ViewStyle } from 'react-native';
import { useTheme } from '../../design/ThemeContext';
import { PressableScale } from '../ui/PressableScale';

type AuthProviderButtonProps = {
  title: string;
  onPress: () => void;
  /** Provider mark (e.g. Ionicons logo). 20–22pt recommended. */
  icon: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

/**
 * OAuth / social sign-in control — matches `Button` secondary styling on auth screens
 * (44pt min height, md radius, glass surface + divider border).
 */
export function AuthProviderButton({
  title,
  onPress,
  icon,
  disabled = false,
  loading = false,
  style,
}: AuthProviderButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        base: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          minHeight: 44,
          borderRadius: theme.radius.md,
          backgroundColor: theme.surfaceGlass,
          borderWidth: 1,
          borderColor: theme.divider,
          width: '100%',
        },
        label: {
          flexShrink: 1,
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
      style={[styles.base, isDisabled && { opacity: 0.5 }, style]}
    >
      {loading ? (
        <ActivityIndicator color={theme.textPrimary} size="small" />
      ) : (
        <>
          {icon}
          <Text
            style={[theme.typography.headline, styles.label, { color: theme.textPrimary }]}
            numberOfLines={1}
          >
            {title}
          </Text>
        </>
      )}
    </PressableScale>
  );
}
