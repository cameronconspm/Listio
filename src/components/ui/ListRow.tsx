import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useTheme } from '../../design/ThemeContext';
import { PressableScale } from './PressableScale';

type ListRowProps = {
  title: string;
  subtitle?: string;
  rightAccessory?: React.ReactNode;
  onPress?: () => void;
  showSeparator?: boolean;
  /** When true, separator spans full width (grouped card context). Default: inset separator. */
  fullWidthDivider?: boolean;
  /** Title-only rows: 44pt touch target, tighter padding, vertically centered (avoids empty space below title). */
  compact?: boolean;
  style?: ViewStyle;
  titleStyle?: TextStyle;
  subtitleStyle?: TextStyle;
};

/** iOS-style list row: title, optional subtitle, optional right accessory, inset separators. */
export function ListRow({
  title,
  subtitle,
  rightAccessory,
  onPress,
  showSeparator = true,
  fullWidthDivider = false,
  compact = false,
  style,
  titleStyle,
  subtitleStyle,
}: ListRowProps) {
  const theme = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          minHeight: 56,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
        },
        rowCompact: {
          minHeight: 44,
          paddingVertical: theme.spacing.xs,
          justifyContent: 'center',
        },
        main: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        text: {
          flex: 1,
          minWidth: 0,
        },
        accessory: {
          marginLeft: theme.spacing.sm,
        },
        separator: {
          height: StyleSheet.hairlineWidth,
          marginTop: theme.spacing.sm,
        },
      }),
    [theme],
  );

  const content = (
    <>
      <View style={styles.main}>
        <View style={styles.text}>
          <Text
            style={[theme.typography.body, { color: theme.textPrimary }, titleStyle]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[
                theme.typography.footnote,
                { color: theme.textSecondary, marginTop: theme.spacing.xxs },
                subtitleStyle,
              ]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {rightAccessory ? <View style={styles.accessory}>{rightAccessory}</View> : null}
      </View>
      {showSeparator ? (
        <View
          style={[
            styles.separator,
            { backgroundColor: theme.divider },
            !fullWidthDivider && { marginLeft: theme.spacing.lg },
          ]}
        />
      ) : null}
    </>
  );

  const a11yLabel = subtitle ? `${title}, ${subtitle}` : title;

  if (onPress) {
    return (
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        onPress={onPress}
        style={[
          styles.row,
          compact && styles.rowCompact,
          { backgroundColor: theme.surface },
          style,
        ]}
      >
        {content}
      </PressableScale>
    );
  }

  return (
    <View
      style={[styles.row, compact && styles.rowCompact, { backgroundColor: theme.surface }, style]}
    >
      {content}
    </View>
  );
}
