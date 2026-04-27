import React, { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../design/ThemeContext';
import { SegmentedPillControl } from '../../ui/components/SegmentedPillControl/SegmentedPillControl';
import type { ShoppingTimeBucket } from '../../services/notificationTimeUtils';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';

/** 0 = Sunday … 6 = Saturday — matches notification prefs. */
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

type Props = {
  syncEnabled: boolean;
  selectedDays: number[];
  onChangeDays: (days: number[]) => void;
  timeBucket: ShoppingTimeBucket;
  onChangeBucket: (bucket: ShoppingTimeBucket) => void;
  compact?: boolean;
};

export function OnboardingShoppingRhythmFeatured({
  syncEnabled,
  selectedDays,
  onChangeDays,
  timeBucket,
  onChangeBucket,
  compact = false,
}: Props) {
  const theme = useTheme();

  const toggleWeekday = useCallback(
    (weekday0: number) => {
      const set = new Set(selectedDays);
      if (set.has(weekday0)) {
        set.delete(weekday0);
      } else {
        set.add(weekday0);
      }
      onChangeDays([...set].sort((a, b) => a - b));
    },
    [selectedDays, onChangeDays]
  );

  return (
    <View style={compact ? styles.wrapCompact : styles.wrap}>
      {!syncEnabled ? (
        <Text style={[theme.typography.body, { color: theme.textSecondary, lineHeight: 24 }]}>
          Personalized reminders sync when your Listio account is connected. You can adjust notifications later in
          Settings.
        </Text>
      ) : (
        <>
          <Text style={[theme.typography.subhead, { color: theme.textSecondary, marginBottom: theme.spacing.xs }]}>
            Which day(s) do you usually shop?
          </Text>
          <Text style={[theme.typography.footnote, { color: theme.textSecondary, marginBottom: theme.spacing.sm }]}>
            Tap all that apply — you can pick more than one.
          </Text>
          <View style={styles.chipWrap}>
            {WEEKDAY_SHORT.map((label, weekday0) => {
              const selected = selectedDays.includes(weekday0);
              return (
                <Pressable
                  key={label}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${label}${selected ? ', selected' : ''}`}
                  onPress={() => toggleWeekday(weekday0)}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      backgroundColor: selected ? theme.accent + '28' : theme.surface,
                      borderColor: selected ? theme.accent : theme.divider,
                      opacity: pressed ? 0.88 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      theme.typography.callout,
                      {
                        color: selected ? theme.accent : theme.textPrimary,
                        fontWeight: selected ? '600' : '500',
                      },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text
            style={[
              theme.typography.subhead,
              { color: theme.textSecondary, marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm },
            ]}
          >
            What time do you usually go?
          </Text>
          <SegmentedPillControl<ShoppingTimeBucket>
            segments={[
              { key: 'morning', label: 'Morning' },
              { key: 'midday', label: 'Midday' },
              { key: 'evening', label: 'Evening' },
            ]}
            value={timeBucket}
            onChange={onChangeBucket}
          />

          <Text
            style={[
              theme.typography.footnote,
              { color: theme.textSecondary, marginTop: theme.spacing.md, lineHeight: 19 },
            ]}
          >
            We will remind you about your list before trips and once a few days ahead to prep. You can change this in
            Settings anytime.
          </Text>
        </>
      )}
    </View>
  );
}

const MIN_TOUCH = 44;

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
  },
  wrapCompact: {
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
