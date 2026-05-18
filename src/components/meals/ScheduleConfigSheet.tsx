import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../design/ThemeContext';
import { BottomSheet } from '../ui/BottomSheet';
import { AppSelectField } from '../ui/AppSelectField';
import { PrimaryButton } from '../ui/PrimaryButton';
import { SelectorRow } from '../ui/SelectorRow';
import { useHaptics } from '../../hooks/useHaptics';
import type { MealScheduleConfig } from '../../hooks/useMealScheduleConfig';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';
import { getWeekdayIndexMonSun, parseYmdLocal, toDateString } from '../../utils/dateUtils';

const LENGTH_OPTIONS: MealScheduleConfig['length'][] = [1, 2, 3, 4, 5, 6, 7];
const WEEKDAY_OPTIONS = [
  { label: 'Monday', weekdayIndex: 0 },
  { label: 'Tuesday', weekdayIndex: 1 },
  { label: 'Wednesday', weekdayIndex: 2 },
  { label: 'Thursday', weekdayIndex: 3 },
  { label: 'Friday', weekdayIndex: 4 },
  { label: 'Saturday', weekdayIndex: 5 },
  { label: 'Sunday', weekdayIndex: 6 },
] as const;

const ROW_LABEL_W = 88;
const MIN_TOUCH = 44;
const fieldFlush = { marginBottom: 0, flex: 1, minWidth: 0 } as const;

function lengthLabel(n: MealScheduleConfig['length']) {
  return `${n} ${n === 1 ? 'day' : 'days'}`;
}

function startDateForWeekday(currentStartDate: string, targetWeekdayIndex: number): string {
  const current = parseYmdLocal(currentStartDate);
  const next = new Date(current);
  const diff = (targetWeekdayIndex - getWeekdayIndexMonSun(current) + 7) % 7;
  next.setDate(current.getDate() + diff);
  return toDateString(next);
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
  const [startWeekday, setStartWeekday] = useState(() =>
    getWeekdayIndexMonSun(parseYmdLocal(config.startDate))
  );
  const [length, setLength] = useState<MealScheduleConfig['length']>(config.length);
  /** Inline list — same pattern as meal type in Add to meals (no second modal / anchored menu). */
  const [lengthPickerOpen, setLengthPickerOpen] = useState(false);
  const [weekdayPickerOpen, setWeekdayPickerOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      setStartWeekday(getWeekdayIndexMonSun(parseYmdLocal(config.startDate)));
      setLength(config.length);
      setLengthPickerOpen(false);
      setWeekdayPickerOpen(false);
    }
  }, [visible, config.startDate, config.length]);

  const handleApply = () => {
    const len = Math.min(7, Math.max(1, length)) as MealScheduleConfig['length'];
    onSave({ startDate: startDateForWeekday(config.startDate, startWeekday), length: len });
    onClose();
  };

  const startWeekdayLabel =
    WEEKDAY_OPTIONS.find((option) => option.weekdayIndex === startWeekday)?.label ?? 'Select';

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
      {weekdayPickerOpen ? (
        <>
          <View style={styles.pickerNav}>
            <TouchableOpacity
              onPress={() => setWeekdayPickerOpen(false)}
              style={styles.navSide}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="chevron-back" size={28} color={theme.accent} />
            </TouchableOpacity>
            <Text style={[theme.typography.title3, styles.pickerTitle, { color: theme.textPrimary }]}>
              Start day
            </Text>
            <View style={styles.navSide} />
          </View>

          <View style={[styles.actionsCard, { backgroundColor: theme.surface }]}>
            {WEEKDAY_OPTIONS.map((option, i) => {
              const selected = startWeekday === option.weekdayIndex;
              return (
                <SelectorRow
                  key={option.weekdayIndex}
                  label={option.label}
                  selected={selected}
                  onPress={() => {
                    haptics.light();
                    setStartWeekday(option.weekdayIndex);
                    setWeekdayPickerOpen(false);
                  }}
                  showDivider={i > 0}
                />
              );
            })}
          </View>
          <View style={{ height: Math.max(insets.bottom, theme.spacing.md) }} />
        </>
      ) : lengthPickerOpen ? (
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
                Start day
              </Text>
              <AppSelectField
                value={startWeekdayLabel}
                onPress={() => setWeekdayPickerOpen(true)}
                placeholder="Select"
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
