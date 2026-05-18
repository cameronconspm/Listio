import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../../design/ThemeContext';
import { BottomSheet } from '../ui/BottomSheet';
import { SelectorRow } from '../ui/SelectorRow';
import type { MealRepeatMode } from '../../utils/dateUtils';
import { spacing } from '../../design/spacing';

const OPTIONS: { key: MealRepeatMode; label: string; subtitle?: string }[] = [
  { key: 'never', label: 'Never', subtitle: 'One meal on the date you pick' },
  { key: 'daily', label: 'Daily', subtitle: 'Next 14 days from that date' },
  { key: 'weekly', label: 'Weekly', subtitle: 'Same weekday for 4 weeks' },
  { key: 'weekdays', label: 'Weekdays', subtitle: 'Mon–Fri for 2 weeks' },
];

type MealRepeatSheetProps = {
  visible: boolean;
  onClose: () => void;
  value: MealRepeatMode;
  onSelect: (mode: MealRepeatMode) => void;
};

export function MealRepeatSheet({ visible, onClose, value, onSelect }: MealRepeatSheetProps) {
  const theme = useTheme();

  return (
    <BottomSheet visible={visible} onClose={onClose} surfaceVariant="solid" presentationVariant="action">
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={[theme.typography.headline, { color: theme.textPrimary }]}>Repeat</Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[theme.typography.body, { color: theme.accent }]}>Cancel</Text>
          </Pressable>
        </View>
      </View>
      <View style={[styles.actions, { backgroundColor: theme.surface }]}>
        {OPTIONS.map((opt, i) => (
          <SelectorRow
            key={opt.key}
            label={opt.label}
            secondary={opt.subtitle}
            selected={value === opt.key}
            onPress={() => {
              onSelect(opt.key);
              onClose();
            }}
            showDivider={i > 0}
          />
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actions: {
    borderRadius: 12,
    overflow: 'hidden',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
});
