import React, { useMemo } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { GlassView } from './GlassView';
import { useTheme } from '../../design/ThemeContext';

type CardProps = {
  children: React.ReactNode;
  glass?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, glass = true, style }: CardProps) {
  const theme = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          padding: theme.spacing.md,
          borderRadius: theme.radius.card,
          overflow: 'hidden',
        },
      }),
    [theme],
  );

  if (glass) {
    return (
      <GlassView style={[styles.card, style]} borderRadius={theme.radius.card}>
        {children}
      </GlassView>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.surface }, style]}>{children}</View>
  );
}
