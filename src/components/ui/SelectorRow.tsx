import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/ThemeContext';
import { PressableScale } from './PressableScale';

const ROW_MIN_HEIGHT = 56;
const ROW_PADDING_H = 16;
const ROW_PADDING_V = 8;
const CHECKMARK_SIZE = 22;

type SelectorRowProps = {
  label: string;
  secondary?: string;
  /** Extra line (e.g. photo attribution) in caption2 below secondary. */
  tertiary?: string;
  selected?: boolean;
  onPress: () => void;
  showDivider?: boolean;
  leftAccessory?: React.ReactNode;
};

/**
 * Canonical selector row: min height 56, padding 16 H / 8 V, full-width divider, 44×44 checkmark hit target.
 * Use inside one grouped selection card per selector sheet.
 */
export function SelectorRow({
  label,
  secondary,
  tertiary,
  selected,
  onPress,
  showDivider = false,
  leftAccessory,
}: SelectorRowProps) {
  const theme = useTheme();

  return (
    <>
      {showDivider ? (
        <View style={[styles.divider, { backgroundColor: theme.divider }]} />
      ) : null}
      <PressableScale
        onPress={onPress}
        pressedOpacity={0.94}
        style={styles.row}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: !!selected }}
      >
        {leftAccessory ?? null}
        <View style={styles.text}>
          <Text
            style={[
              theme.typography.body,
              { color: selected ? theme.accent : theme.textPrimary, fontWeight: selected ? '600' : '400' },
            ]}
          >
            {label}
          </Text>
          {secondary ? (
            <Text style={[theme.typography.footnote, { color: theme.textSecondary, marginTop: theme.spacing.xxs }]}>
              {secondary}
            </Text>
          ) : null}
          {tertiary ? (
            <Text
              style={[theme.typography.caption2, { color: theme.textSecondary, marginTop: theme.spacing.xxs, opacity: 0.9 }]}
              numberOfLines={2}
            >
              {tertiary}
            </Text>
          ) : null}
        </View>
        {selected ? (
          <View style={styles.checkmark}>
            <Ionicons name="checkmark-circle" size={CHECKMARK_SIZE} color={theme.accent} />
          </View>
        ) : null}
      </PressableScale>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: ROW_MIN_HEIGHT,
    paddingVertical: ROW_PADDING_V,
    paddingHorizontal: ROW_PADDING_H,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  checkmark: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: -10,
  },
  divider: {
    height: 1,
  },
});
