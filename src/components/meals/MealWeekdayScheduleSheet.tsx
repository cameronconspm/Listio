import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Pressable } from 'react-native';
import { useTheme } from '../../design/ThemeContext';
import { BottomSheet } from '../ui/BottomSheet';
import { PrimaryButton } from '../ui/PrimaryButton';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';

export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const RECURRING_WEEK_OPTIONS = [4, 8, 12] as const;

const MIN_TOUCH = 44;

type MealWeekdayScheduleSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  confirmLabel: string;
  weekdays: boolean[];
  onWeekdaysChange: (next: boolean[]) => void;
  recurring: boolean;
  onRecurringChange: (v: boolean) => void;
  recurringWeeks: number;
  onRecurringWeeksChange: (w: number) => void;
  onConfirm: () => void;
  loading?: boolean;
};

export function MealWeekdayScheduleSheet({
  visible,
  onClose,
  title,
  subtitle,
  confirmLabel,
  weekdays,
  onWeekdaysChange,
  recurring,
  onRecurringChange,
  recurringWeeks,
  onRecurringWeeksChange,
  onConfirm,
  loading = false,
}: MealWeekdayScheduleSheetProps) {
  const theme = useTheme();

  const toggleDay = (idx: number) => {
    const next = [...weekdays];
    next[idx] = !next[idx];
    onWeekdaysChange(next);
  };

  const anySelected = weekdays.some(Boolean);

  return (
    <BottomSheet visible={visible} onClose={onClose} surfaceVariant="solid" presentationVariant="form">
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={[theme.typography.headline, { color: theme.textPrimary }]}>{title}</Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cancel schedule changes"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[theme.typography.body, { color: theme.accent }]}>Cancel</Text>
          </Pressable>
        </View>
        {subtitle ? (
          <Text
            style={[
              theme.typography.footnote,
              { color: theme.textSecondary, marginTop: theme.spacing.xs },
            ]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      <Text
        style={[
          theme.typography.footnote,
          { color: theme.textSecondary, marginBottom: theme.spacing.sm, paddingHorizontal: theme.spacing.lg },
        ]}
      >
        Days of week
      </Text>
      <View style={styles.weekRow}>
        {WEEKDAY_SHORT.map((label, idx) => {
          const on = weekdays[idx];
          return (
            <TouchableOpacity
              key={label}
              onPress={() => toggleDay(idx)}
              style={[
                styles.dayPill,
                {
                  minWidth: MIN_TOUCH,
                  minHeight: MIN_TOUCH,
                  backgroundColor: on ? theme.accent : theme.surface,
                  borderColor: on ? theme.accent : theme.divider,
                },
              ]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  theme.typography.footnote,
                  { color: on ? theme.onAccent : theme.textPrimary, fontWeight: '600' },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={[theme.typography.body, { color: theme.textPrimary }]}>Recurring</Text>
            <Text
              style={[
                theme.typography.footnote,
                { color: theme.textSecondary, marginTop: theme.spacing.xxs },
              ]}
            >
              {recurring ? 'Same weekdays each week' : 'Next occurrence from today'}
            </Text>
          </View>
          <Switch
            value={recurring}
            onValueChange={onRecurringChange}
            trackColor={{ false: theme.textSecondary + '35', true: theme.accent }}
            thumbColor={theme.onAccent}
          />
        </View>
        {recurring ? (
          <View style={[styles.weeksRow, { borderTopColor: theme.divider }]}>
            <Text style={[theme.typography.footnote, { color: theme.textSecondary, marginBottom: theme.spacing.sm }]}>
              How many weeks
            </Text>
            <View style={styles.weekPills}>
              {RECURRING_WEEK_OPTIONS.map((w) => {
                const selected = recurringWeeks === w;
                return (
                  <TouchableOpacity
                    key={w}
                    onPress={() => onRecurringWeeksChange(w)}
                    style={[
                      styles.weekPill,
                      {
                        backgroundColor: selected ? theme.accent : theme.background,
                        borderColor: selected ? theme.accent : theme.divider,
                      },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        theme.typography.body,
                        { color: selected ? theme.onAccent : theme.textPrimary },
                      ]}
                    >
                      {w} wk
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        <PrimaryButton
          title={confirmLabel}
          onPress={onConfirm}
          loading={loading}
          disabled={!anySelected}
        />
      </View>
    </BottomSheet>
  );
}

export function formatWeekdayScheduleSummary(
  weekdays: boolean[],
  recurring: boolean,
  recurringWeeks: number
): string {
  const picked = WEEKDAY_SHORT.filter((_, i) => weekdays[i]).join(', ');
  if (!picked) return 'Tap to set';
  if (!recurring) return `${picked} · next`;
  return `${picked} · ${recurringWeeks} wk${recurringWeeks !== 1 ? 's' : ''} each`;
}

const styles = StyleSheet.create({
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  toggleText: { flex: 1, minWidth: 0, marginRight: spacing.sm },
  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MIN_TOUCH,
    gap: spacing.sm,
  },
  weekRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    justifyContent: 'space-between',
  },
  dayPill: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  card: {
    marginHorizontal: spacing.md,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  weeksRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  weekPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  weekPill: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: MIN_TOUCH,
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
});
