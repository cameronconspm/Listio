import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../design/ThemeContext';
import { spacing } from '../../design/spacing';
type Props = {
  visible: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Subtle hint while a cached query refetches in the background (not during pull-to-refresh). */
export function QueryUpdatingBar({ visible, style }: Props) {
  const theme = useTheme();
  if (!visible) return null;
  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: theme.surface,
          borderBottomColor: theme.divider,
        },
        style,
      ]}
    >
      <ActivityIndicator size="small" color={theme.accent} />
      <Text style={[theme.typography.caption1, { color: theme.textSecondary, marginLeft: theme.spacing.sm }]}>
        Updating…
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
