import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../design/ThemeContext';
import { BottomSheet } from '../ui/BottomSheet';
import { AppDateField } from '../ui/AppDateField';
import { AppSelectField } from '../ui/AppSelectField';
import { PrimaryButton } from '../ui/PrimaryButton';
import { SelectorRow } from '../ui/SelectorRow';
import { useHaptics } from '../../hooks/useHaptics';
import type { MealScheduleConfig } from '../../hooks/useMealScheduleConfig';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';

const LENGTH_OPTIONS: MealScheduleConfig['length'][] = [1, 2, 3, 4, 5, 6, 7];

const ROW_LABEL_W = 88;
const MIN_TOUCH = 44;
const fieldFlush = { marginBottom: 0, flex: 1, minWidth: 0 } as const;

function lengthLabel(n: MealScheduleConfig['length']) {
  return `${n} ${n === 1 ? 'day' : 'days'}`;
}

type ScheduleConfigSheetProps = {
  visible: boolean;
  onClose: () => void;
  config: MealScheduleConfig;
  onSave: (config: MealScheduleConfig) => void;
};

export function ScheduleConfigSheet({
  visible,
  onClose,
  config,
  onSave,
}: ScheduleConfigSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const [startDate, setStartDate] = useState(config.startDate);
  const [length, setLength] = useState<MealScheduleConfig['length']>(config.length);
  /** Inline list — same pattern as meal type in Add to meals (no second modal / anchored menu). */
  const [lengthPickerOpen, setLengthPickerOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      setStartDate(config.startDate);
      setLength(config.length);
      setLengthPickerOpen(false);
    }
  }, [visible, config.startDate, config.length]);

  const handleApply = () => {
    const trimmed = startDate.trim();
    if (!trimmed || !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return;
    const len = Math.min(7, Math.max(1, length)) as MealScheduleConfig['length'];
    onSave({ startDate: trimmed, length: len });
    onClose();
  };

  const dateInvalid = !startDate.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(startDate.trim());

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
      {lengthPickerOpen ? (
        <>
          <View style={styles.pickerNav}>
            <TouchableOpacity
              onPress={() => setLengthPickerOpen(false)}
              style={styles.navSide}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="chevron-back" size={28} color={theme.accent} />
            </TouchableOpacity>
            <Text style={[theme.typography.title3, styles.pickerTitle, { color: theme.textPrimary }]}>
              Planning length
            </Text>
            <View style={styles.navSide} />
          </View>

          <View style={[styles.actionsCard, { backgroundColor: theme.surface }]}>
            {LENGTH_OPTIONS.map((n, i) => {
              const selected = length === n;
              return (
                <SelectorRow
                  key={n}
                  label={lengthLabel(n)}
                  selected={selected}
                  onPress={() => {
                    haptics.light();
                    setLength(n);
                    setLengthPickerOpen(false);
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
            <Text style={[theme.typography.title3, { color: theme.textPrimary }]}>Meal schedule</Text>
            <Text
              style={[theme.typography.caption1, { color: theme.textSecondary, marginTop: theme.spacing.xs }]}
            >
              Choose how many days you want to plan at once
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
                Start date
              </Text>
              <AppDateField
                value={startDate}
                onChange={setStartDate}
                embedded
                containerStyle={fieldFlush}
              />
            </View>
            <View style={[styles.groupDivider, { backgroundColor: theme.divider }]} />
            <View style={styles.groupRow}>
              <Text style={[theme.typography.footnote, styles.rowLabel, { color: theme.textSecondary }]}>
                Length
              </Text>
              <AppSelectField
                value={lengthLabel(length)}
                onPress={() => setLengthPickerOpen(true)}
                placeholder="Select"
                embedded
                containerStyle={fieldFlush}
              />
            </View>
          </View>

          <PrimaryButton
            title="Apply"
            onPress={handleApply}
            disabled={dateInvalid}
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
  confirmBtn: {
    marginTop: spacing.sm,
  },
});
