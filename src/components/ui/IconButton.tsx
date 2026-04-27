import React, { useMemo } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useHaptics } from '../../hooks/useHaptics';
import { useTheme } from '../../design/ThemeContext';
import { PressableScale } from './PressableScale';

type IconButtonProps = {
  children: React.ReactNode;
  onPress: () => void;
  hitSlop?: number;
  style?: ViewStyle;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

export function IconButton({
  children,
  onPress,
  hitSlop = 12,
  style,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
}: IconButtonProps) {
  const haptics = useHaptics();
  const theme = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        button: {
          padding: theme.spacing.sm,
          justifyContent: 'center',
          alignItems: 'center',
        },
        content: {
          justifyContent: 'center',
          alignItems: 'center',
        },
      }),
    [theme],
  );

  const handlePress = () => {
    haptics.light();
    onPress();
  };

  return (
    <PressableScale
      accessibilityRole={accessibilityLabel ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={handlePress}
      disabled={disabled}
      hitSlop={{ top: hitSlop, bottom: hitSlop, left: hitSlop, right: hitSlop }}
      style={[styles.button, { borderRadius: theme.radius.sm }, style]}
    >
      <View style={styles.content}>{children}</View>
    </PressableScale>
  );
}
