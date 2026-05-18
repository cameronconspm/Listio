import React, { useMemo } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  Platform,
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
  /**
   * `shrinkWrap` omits the default 50pt min-height so multiline fields can size from
   * `onContentSizeChange` / explicit `style.height` (e.g. recipe step rows).
   */
  inputVariant?: 'default' | 'shrinkWrap';
  /**
   * Vertical alignment for multiline inputs. Default `top` (e.g. recipe steps).
   * Use `center` for short multiline notes so the placeholder sits mid-field.
   */
  multilineVerticalAlign?: 'top' | 'center';
  /**
   * Box height used for `multilineVerticalAlign="center"` min-height and iOS vertical padding math.
   * Defaults to 64; use a smaller value for compact rows (e.g. recipe steps).
   */
  multilineCenterMinHeight?: number;
};

export function TextField({
  label,
  error,
  containerStyle,
  formatOnBlur,
  inputVariant = 'default',
  style,
  onBlur,
  onChangeText,
  value,
  multiline,
  multilineVerticalAlign = 'top',
  multilineCenterMinHeight,
  textAlign: textAlignProp = 'left',
  textAlignVertical: textAlignVerticalProp,
  ...rest
}: TextFieldProps) {
  const theme = useTheme();

  const verticalAlign =
    textAlignVerticalProp ?? (multiline ? multilineVerticalAlign : 'center');

  const centeredMultiline = multiline && multilineVerticalAlign === 'center';
  /** Short multiline notes: compact height; placeholder still centered on iOS via padding below. */
  const centeredMultilineDefaultMinHeight = 64;
  const centerBox = multilineCenterMinHeight ?? centeredMultilineDefaultMinHeight;
  /** iOS multiline UITextView ignores `textAlignVertical`; pad to center one line in a min-height box. */
  const iosCenteredMultiline = Platform.OS === 'ios' && centeredMultiline;
  const iosNotesLineApprox = 22;
  const iosNotesVerticalPad = Math.max(
    theme.spacing.xs,
    (centerBox - iosNotesLineApprox) / 2
  );

  const styles = useMemo(() => {
    const androidFontMetrics =
      Platform.OS === 'android' ? ({ includeFontPadding: false } as const) : null;
    return StyleSheet.create({
      wrapper: {
        marginBottom: theme.spacing.md,
      },
      inputDefault: {
        minHeight: 50,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.input,
        borderWidth: 1,
        width: '100%',
        ...(androidFontMetrics ?? {}),
      },
      inputShrinkWrap: {
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.input,
        borderWidth: 1,
        width: '100%',
        ...(androidFontMetrics ?? {}),
      },
    });
  }, [theme]);

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
        keyboardAppearance={theme.colorScheme}
        multiline={multiline}
        textAlign={textAlignProp}
        textAlignVertical={verticalAlign}
        style={[
          theme.typography.body,
          inputVariant === 'shrinkWrap' ? styles.inputShrinkWrap : styles.inputDefault,
          {
            backgroundColor: theme.surface,
            borderColor: error ? theme.danger : theme.divider,
            color: theme.textPrimary,
          },
          centeredMultiline
            ? { minHeight: centerBox, paddingVertical: theme.spacing.xs }
            : null,
          iosCenteredMultiline
            ? {
                paddingTop: iosNotesVerticalPad,
                paddingBottom: iosNotesVerticalPad,
              }
            : null,
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
