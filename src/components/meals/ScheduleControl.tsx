import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/ThemeContext';
import { spacing } from '../../design/spacing';
type ScheduleControlProps = {
  label: string;
  onPress: () => void;
  onPrev: () => void;
  onNext: () => void;
};

/**
 * Range row: main control for planning window.
 * Tap label → opens schedule config. Arrows move by configured length.
 */
export function ScheduleControl({ label, onPress, onPrev, onNext }: ScheduleControlProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onPrev} style={styles.chevron} hitSlop={8}>
        <Ionicons name="chevron-back" size={22} color={theme.textSecondary} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.labelWrap} onPress={onPress} activeOpacity={0.7}>
        <Text style={[theme.typography.subhead, { color: theme.textPrimary }]} numberOfLines={1}>
          {label}
        </Text>
        <Ionicons name="chevron-down" size={16} color={theme.textSecondary} style={styles.chevronDown} />
      </TouchableOpacity>
      <TouchableOpacity onPress={onNext} style={styles.chevron} hitSlop={8}>
        <Ionicons name="chevron-forward" size={22} color={theme.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.xxs,
    paddingBottom: spacing.xxs,
  },
  chevron: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  chevronDown: {
    opacity: 0.8,
  },
});
