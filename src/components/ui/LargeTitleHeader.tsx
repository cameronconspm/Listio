import React, { useMemo } from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../../design/ThemeContext';

type LargeTitleHeaderProps = {
  title: string;
  rightAction?: React.ReactNode;
  style?: ViewStyle;
};

/** iOS-style large title with optional right action. Use when not relying on native-stack headerLargeTitle. */
export function LargeTitleHeader({ title, rightAction, style }: LargeTitleHeaderProps) {
  const theme = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
        },
        action: {
          marginLeft: theme.spacing.sm,
        },
      }),
    [theme],
  );

  return (
    <View style={[styles.container, style]}>
      <Text style={[theme.typography.largeTitle, { color: theme.textPrimary }]} numberOfLines={1}>
        {title}
      </Text>
      {rightAction ? <View style={styles.action}>{rightAction}</View> : null}
    </View>
  );
}
