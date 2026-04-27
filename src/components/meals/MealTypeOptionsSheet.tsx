import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../design/ThemeContext';
import { BottomSheet } from '../ui/BottomSheet';
import { SelectorRow } from '../ui/SelectorRow';
import type { MealSlot } from '../../types/models';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';

/** Shared with inline pickers that cannot stack a second `Modal` (e.g. nested bottom sheets). */
export const MEAL_TYPE_PICKER_OPTIONS: { key: MealSlot; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'dessert', label: 'Dessert' },
  { key: 'custom', label: 'Custom' },
];

const SLOT_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  dessert: 'Dessert',
  custom: 'Custom',
};

export function formatMealSlotLabel(slot: MealSlot, customName?: string | null): string {
  if (slot === 'custom' && customName?.trim()) return customName.trim();
  return SLOT_LABELS[slot] ?? slot;
}

type MealTypeOptionsSheetProps = {
  visible: boolean;
  onClose: () => void;
  value: MealSlot;
  customSlotName?: string;
  onSelect: (slot: MealSlot) => void;
};

/** Uses same BottomSheet + action-row pattern as ListActionsSheet and AppActionSheet. */
export function MealTypeOptionsSheet({
  visible,
  onClose,
  value,
  customSlotName,
  onSelect,
}: MealTypeOptionsSheetProps) {
  const theme = useTheme();

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      surfaceVariant="solid"
      presentationVariant="action"
    >
      <View style={styles.header}>
        <Text style={[theme.typography.headline, { color: theme.textPrimary }]}>Meal type</Text>
      </View>
      <View style={[styles.actions, { backgroundColor: theme.surface }]}>
        {MEAL_TYPE_PICKER_OPTIONS.map((opt, i) => {
          const isSelected = value === opt.key;
          const displayLabel =
            opt.key === 'custom' && customSlotName?.trim()
              ? `Custom: ${customSlotName.trim()}`
              : opt.label;

          return (
            <SelectorRow
              key={opt.key}
              label={displayLabel}
              selected={isSelected}
              onPress={() => {
                onSelect(opt.key);
                onClose();
              }}
              showDivider={i > 0}
            />
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.lg,
  },
  actions: {
    overflow: 'hidden',
    borderRadius: radius.card,
  },
});
