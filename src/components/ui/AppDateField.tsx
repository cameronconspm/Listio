import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/ThemeContext';
import { DatePickerSheet } from './DatePickerSheet';
import { formatDayLabel } from '../../utils/dateUtils';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';

type AppDateFieldProps = {
  value: string;
  onChange: (dateString: string) => void;
  label?: string;
  containerStyle?: ViewStyle;
  placeholder?: string;
  /** Inset field fill (e.g. on solid white sheets) for contrast against `theme.surface`. */
  tone?: 'default' | 'inset';
  /** No border/fill — use inside a grouped card (parent provides outline). */
  embedded?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * Date field that opens app-styled date picker sheet. No raw date typing.
 * Display: human-readable. Store: YYYY-MM-DD.
 */
export function AppDateField({
  value,
  onChange,
  label,
  containerStyle,
  placeholder = 'Select date',
  tone = 'default',
  embedded = false,
  accessibilityLabel,
  testID,
}: AppDateFieldProps) {
  const theme = useTheme();
  const [sheetVisible, setSheetVisible] = useState(false);
  const fieldBg = embedded ? 'transparent' : tone === 'inset' ? theme.background : theme.surface;

  const displayText = value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? formatDayLabel(new Date(value + 'T12:00:00'))
    : '';

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label ? (
        <Text style={[theme.typography.footnote, { color: theme.textSecondary, marginBottom: theme.spacing.sm }]}>
          {label}
        </Text>
      ) : null}
      <TouchableOpacity
        onPress={() => setSheetVisible(true)}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label ?? placeholder}
        accessibilityHint="Opens date picker"
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
            { color: displayText ? theme.textPrimary : theme.textSecondary },
          ]}
        >
          {displayText || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />
      </TouchableOpacity>

      <DatePickerSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        value={value}
        onSelect={onChange}
      />
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
