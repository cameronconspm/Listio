import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/ThemeContext';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';
type AppSelectFieldProps = {
  value: string;
  onPress: () => void;
  label?: string;
  placeholder?: string;
  containerStyle?: ViewStyle;
  /** Match `AppDateField` inset fill on grouped forms / sheets. */
  tone?: 'default' | 'inset';
  /** No border/fill — use inside a grouped card. */
  embedded?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * Tappable field row: value left, chevron right.
 * Tap opens app-styled bottom sheet selector (parent provides sheet).
 * Use for meal type, units, store, and other structured choices.
 */
export function AppSelectField({
  value,
  onPress,
  label,
  placeholder = 'Select',
  containerStyle,
  tone = 'default',
  embedded = false,
  accessibilityLabel,
  testID,
}: AppSelectFieldProps) {
  const theme = useTheme();
  const fieldBg = embedded ? 'transparent' : tone === 'inset' ? theme.background : theme.surface;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label ? (
        <Text style={[theme.typography.footnote, { color: theme.textSecondary, marginBottom: theme.spacing.xs }]}>
          {label}
        </Text>
      ) : null}
      <TouchableOpacity
        onPress={onPress}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label ?? placeholder}
        accessibilityHint="Opens a list of options"
        style={[
          styles.field,
          embedded && styles.fieldEmbedded,
          {
            backgroundColor: fieldBg,
            borderColor: theme.divider,
            borderWidth: embedded ? 0 : 1,
          },
        ]}
      >
        <Text
          style={[
            theme.typography.body,
            { color: value ? theme.textPrimary : theme.textSecondary },
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 50,
    paddingHorizontal: spacing.md,
    borderRadius: radius.input,
    borderWidth: 1,
  },
  fieldEmbedded: {
    height: 44,
    paddingHorizontal: spacing.xs,
    borderRadius: 0,
    justifyContent: 'flex-end',
    gap: spacing.xs,
  },
});
