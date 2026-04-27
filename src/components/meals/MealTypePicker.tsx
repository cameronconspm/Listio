import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../design/ThemeContext';
import type { MealSlot } from '../../types/models';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';

const SLOT_OPTIONS: { key: MealSlot; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'dessert', label: 'Dessert' },
  { key: 'custom', label: 'Custom' },
];

type MealTypePickerProps = {
  value: MealSlot;
  onChange: (slot: MealSlot) => void;
};

const PILL_MIN_HEIGHT = 44;

export function MealTypePicker({ value, onChange }: MealTypePickerProps) {
  const theme = useTheme();

  const row1 = SLOT_OPTIONS.slice(0, 3);
  const row2 = SLOT_OPTIONS.slice(3, 5);

  const renderPill = (opt: { key: MealSlot; label: string }, isLastInRow: boolean) => {
    const isSelected = value === opt.key || (opt.key === 'custom' && value === 'custom');

    return (
      <TouchableOpacity
        key={opt.key}
        onPress={() => onChange(opt.key)}
        style={[
          styles.pill,
          isLastInRow && styles.pillLast,
          {
            backgroundColor: isSelected ? theme.accent : theme.surfaceGlass,
            borderColor: isSelected ? theme.accent : theme.divider,
            borderWidth: 1,
          },
        ]}
        activeOpacity={0.8}
      >
        <Text
          style={[
            theme.typography.subhead,
            {
              color: isSelected ? theme.onAccent : theme.textPrimary,
              fontWeight: isSelected ? '600' : '400',
            },
          ]}
          numberOfLines={1}
        >
          {opt.label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {row1.map((opt, i) => renderPill(opt, i === row1.length - 1))}
      </View>
      <View style={[styles.row, { marginBottom: 0 }]}>
        {row2.map((opt, i) => renderPill(opt, i === row2.length - 1))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  row: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  pill: {
    flex: 1,
    minHeight: PILL_MIN_HEIGHT,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  pillLast: { marginRight: 0 },
});
