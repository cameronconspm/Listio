import React, { useMemo } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  type TextInputProps,
  type ViewStyle,
  type BlurEvent,
} from 'react-native';
import { useTheme } from '../../design/ThemeContext';
import { titleCaseWords } from '../../utils/titleCaseWords';

type TextFieldProps = TextInputProps & {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  /** When set, formats the value on blur (controlled `value` + `onChangeText` required). */
  formatOnBlur?: 'titleWords';
};

export function TextField({
  label,
  error,
  containerStyle,
  formatOnBlur,
  style,
  onBlur,
  onChangeText,
  value,
  ...rest
}: TextFieldProps) {
  const theme = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          marginBottom: theme.spacing.md,
        },
        input: {
          minHeight: 50,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.input,
          borderWidth: 1,
        },
      }),
    [theme],
  );

  const handleBlur = (e: BlurEvent) => {
    if (formatOnBlur === 'titleWords' && typeof value === 'string' && onChangeText) {
      const next = titleCaseWords(value);
      if (next !== value) {
        onChangeText(next);
      }
    }
    onBlur?.(e);
  };

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label ? (
        <Text
          style={[theme.typography.footnote, { color: theme.textSecondary, marginBottom: theme.spacing.xs }]}
        >
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={theme.textSecondary}
        style={[
          theme.typography.body,
          styles.input,
          {
            backgroundColor: theme.surface,
            borderColor: error ? theme.danger : theme.divider,
            color: theme.textPrimary,
          },
          style,
        ]}
        {...rest}
        {...(value !== undefined ? { value } : {})}
        onChangeText={onChangeText}
        onBlur={handleBlur}
      />
      {error ? (
        <Text style={[theme.typography.caption1, { color: theme.danger, marginTop: theme.spacing.xs }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
