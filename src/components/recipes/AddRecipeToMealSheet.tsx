import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/ThemeContext';
import { BottomSheet } from '../ui/BottomSheet';
import { AppDateField } from '../ui/AppDateField';
import { AppSelectField } from '../ui/AppSelectField';
import { TextField } from '../ui/TextField';
import { PrimaryButton } from '../ui/PrimaryButton';
import { SelectorRow } from '../ui/SelectorRow';
import { MEAL_TYPE_PICKER_OPTIONS, formatMealSlotLabel } from '../meals/MealTypeOptionsSheet';
import type { MealSlot } from '../../types/models';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';
import { toDateString } from '../../utils/dateUtils';

export type AddRecipeToMealPayload = {
  meal_date: string;
  meal_slot: MealSlot;
  custom_slot_name: string | null;
};

type AddRecipeToMealSheetProps = {
  visible: boolean;
  onClose: () => void;
  recipeName: string;
  loading?: boolean;
  onConfirm: (payload: AddRecipeToMealPayload) => void;
};

const ROW_LABEL_W = 88;
const MIN_TOUCH = 44;

export function AddRecipeToMealSheet({
  visible,
  onClose,
  recipeName,
  loading,
  onConfirm,
}: AddRecipeToMealSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [mealDate, setMealDate] = useState(() => toDateString(new Date()));
  const [mealSlot, setMealSlot] = useState<MealSlot>('dinner');
  const [customSlotName, setCustomSlotName] = useState('');
  /** Inline meal list — avoids a second `Modal` behind the parent sheet on iOS. */
  const [mealPickerOpen, setMealPickerOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      setMealDate(toDateString(new Date()));
      setMealSlot('dinner');
      setCustomSlotName('');
      setMealPickerOpen(false);
    }
  }, [visible]);

  const handleConfirm = () => {
    const trimmed = mealDate.trim();
    if (!trimmed || !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return;
    if (mealSlot === 'custom' && !customSlotName.trim()) return;
    onConfirm({
      meal_date: trimmed,
      meal_slot: mealSlot,
      custom_slot_name: mealSlot === 'custom' ? customSlotName.trim() : null,
    });
  };

  const customInvalid = mealSlot === 'custom' && !customSlotName.trim();
  const dateInvalid = !mealDate.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(mealDate.trim());

  const fieldFlush = { marginBottom: 0, flex: 1, minWidth: 0 } as const;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      size="form"
      surfaceVariant="solid"
      keyboardLift="padding"
      formHugContent
      formCompact
      compactHeader
    >
      {mealPickerOpen ? (
        <>
          <View style={styles.pickerNav}>
            <TouchableOpacity
              onPress={() => setMealPickerOpen(false)}
              style={styles.navSide}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="chevron-back" size={28} color={theme.accent} />
            </TouchableOpacity>
            <Text style={[theme.typography.title3, styles.pickerTitle, { color: theme.textPrimary }]}>
              Meal type
            </Text>
            <View style={styles.navSide} />
          </View>

          <View style={[styles.actionsCard, { backgroundColor: theme.surface }]}>
            {MEAL_TYPE_PICKER_OPTIONS.map((opt, i) => {
              const displayLabel =
                opt.key === 'custom' && customSlotName.trim()
                  ? `Custom: ${customSlotName.trim()}`
                  : opt.label;
              return (
                <SelectorRow
                  key={opt.key}
                  label={displayLabel}
                  selected={mealSlot === opt.key}
                  onPress={() => {
                    setMealSlot(opt.key);
                    if (opt.key !== 'custom') setCustomSlotName('');
                    setMealPickerOpen(false);
                  }}
                  showDivider={i > 0}
                />
              );
            })}
          </View>
          <View style={{ height: Math.max(insets.bottom, theme.spacing.md) }} />
        </>
      ) : (
        <>
          <View style={styles.header}>
            <Text style={[theme.typography.title3, { color: theme.textPrimary }]}>Add to meals</Text>
            <Text
              style={[theme.typography.caption1, { color: theme.textSecondary, marginTop: theme.spacing.xs }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {recipeName}
            </Text>
          </View>

          <View
            style={[
              styles.group,
              {
                backgroundColor: theme.background,
                borderColor: theme.divider,
              },
            ]}
          >
            <View style={styles.groupRow}>
              <Text style={[theme.typography.footnote, styles.rowLabel, { color: theme.textSecondary }]}>
                Date
              </Text>
              <AppDateField
                value={mealDate}
                onChange={setMealDate}
                embedded
                containerStyle={fieldFlush}
              />
            </View>
            <View style={[styles.groupDivider, { backgroundColor: theme.divider }]} />
            <View style={styles.groupRow}>
              <Text style={[theme.typography.footnote, styles.rowLabel, { color: theme.textSecondary }]}>
                Meal
              </Text>
              <AppSelectField
                value={formatMealSlotLabel(mealSlot, mealSlot === 'custom' ? customSlotName : null)}
                onPress={() => setMealPickerOpen(true)}
                placeholder="Select"
                embedded
                containerStyle={fieldFlush}
              />
            </View>
          </View>

          {mealSlot === 'custom' ? (
            <TextField
              label="Custom slot"
              value={customSlotName}
              onChangeText={setCustomSlotName}
              placeholder="e.g. Snack, Brunch"
              containerStyle={styles.customField}
            />
          ) : null}

          <PrimaryButton
            title="Add meal"
            onPress={handleConfirm}
            loading={loading}
            disabled={dateInvalid || customInvalid}
            flat
            style={{
              ...styles.confirmBtn,
              marginBottom: Math.max(insets.bottom, theme.spacing.md),
            }}
          />
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.md,
  },
  pickerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    minHeight: MIN_TOUCH,
  },
  navSide: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  pickerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  actionsCard: {
    overflow: 'hidden',
    borderRadius: radius.card,
    marginBottom: spacing.sm,
  },
  group: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    minHeight: 52,
  },
  rowLabel: {
    width: ROW_LABEL_W,
    marginRight: spacing.sm,
  },
  groupDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: spacing.md,
    alignSelf: 'stretch',
  },
  customField: {
    marginBottom: spacing.md,
  },
  confirmBtn: {
    marginTop: spacing.sm,
  },
});
