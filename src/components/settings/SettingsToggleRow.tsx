import React from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { useTheme } from '../../design/ThemeContext';
import { spacing } from '../../design/spacing';
type SettingsToggleRowProps = {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  /** Default true. Set false for the first row in a grouped card. */
  showTopBorder?: boolean;
};

/** Toggle row for settings screens. */
export function SettingsToggleRow({
  title,
  subtitle,
  value,
  onValueChange,
  disabled = false,
  showTopBorder = true,
}: SettingsToggleRowProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.row,
        { borderTopColor: theme.divider, minHeight: subtitle ? 68 : 56 },
        !showTopBorder && { borderTopWidth: 0 },
      ]}
    >
      <View style={styles.text}>
        <Text style={[theme.typography.body, { color: theme.textPrimary }]}>{title}</Text>
        {subtitle ? (
          <Text
            style={[theme.typography.footnote, { color: theme.textSecondary, marginTop: theme.spacing.xxs }]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: theme.textSecondary + '35', true: theme.accent }}
        thumbColor={theme.onAccent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  text: { flex: 1, minWidth: 0, marginRight: spacing.sm },
});
