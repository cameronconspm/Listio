import React, { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useTheme } from '../../design/ThemeContext';
import { SegmentedPillControl } from '../../ui/components/SegmentedPillControl/SegmentedPillControl';
import type { ShoppingTimeBucket } from '../../services/notificationTimeUtils';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';
import { OnboardingStagger } from './OnboardingStagger';
import { useReduceMotion } from '../../ui/motion/useReduceMotion';

/** 0 = Sunday … 6 = Saturday — matches notification prefs. */
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const BENEFITS = [
  { icon: 'notifications-outline' as const, title: 'Before you shop', body: 'A nudge to review your list so nothing is forgotten.' },
  { icon: 'calendar-outline' as const, title: 'Prep ahead', body: 'Reminders a few days before your usual trip to plan meals.' },
  { icon: 'settings-outline' as const, title: 'Your schedule', body: 'Change days or times anytime in Settings.' },
];

type Props = {
  syncEnabled: boolean;
  selectedDays: number[];
  onChangeDays: (days: number[]) => void;
  timeBucket: ShoppingTimeBucket;
  onChangeBucket: (bucket: ShoppingTimeBucket) => void;
  compact?: boolean;
};

function WeekdayChip({
  label,
  weekday0,
  selected,
  onToggle,
}: {
  label: string;
  weekday0: number;
  selected: boolean;
  onToggle: (d: number) => void;
}) {
  const theme = useTheme();
  const reduced = useReduceMotion();
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`${label}${selected ? ', selected' : ''}`}
        onPressIn={() => {
          if (!reduced) scale.value = withSpring(0.94, { damping: 18, stiffness: 400 });
        }}
        onPressOut={() => {
          if (!reduced) scale.value = withSpring(1, { damping: 18, stiffness: 400 });
        }}
        onPress={() => onToggle(weekday0)}
        style={({ pressed }) => [
          styles.chip,
          {
            backgroundColor: selected ? theme.accent + '28' : theme.surface,
            borderColor: selected ? theme.accent : theme.divider,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
      >
        <Text
          style={[
            theme.typography.callout,
            {
              color: selected ? theme.accent : theme.textPrimary,
              fontWeight: selected ? '700' : '500',
            },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

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
      <OnboardingStagger index={1}>
        <View style={styles.benefitRow}>
          {BENEFITS.map((b) => (
            <View
              key={b.title}
              style={[
                styles.benefitCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.divider,
                },
                theme.shadows.card,
              ]}
            >
              <View style={[styles.benefitIcon, { backgroundColor: theme.accent + '16' }]}>
                <Ionicons name={b.icon} size={18} color={theme.accent} />
              </View>
              <Text style={[theme.typography.caption1, { color: theme.textPrimary, fontWeight: '700', marginTop: 8 }]}>
                {b.title}
              </Text>
              <Text style={[theme.typography.caption2, { color: theme.textSecondary, marginTop: 4, lineHeight: 15 }]}>
                {b.body}
              </Text>
            </View>
          ))}
        </View>
      </OnboardingStagger>

      <OnboardingStagger index={2}>
        <View
          style={[
            styles.formCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.divider,
            },
            theme.shadows.elevated,
          ]}
        >
          {!syncEnabled ? (
            <Text style={[theme.typography.body, { color: theme.textSecondary, lineHeight: 24 }]}>
              Sign in to set shopping-day reminders here. You can change notifications anytime in Settings.
            </Text>
          ) : (
            <>
              <View style={styles.formHeader}>
                <View style={[styles.bellCircle, { backgroundColor: theme.accent + '18' }]}>
                  <Ionicons name="alarm-outline" size={22} color={theme.accent} />
                </View>
                <Text style={[theme.typography.subhead, { color: theme.textPrimary, fontWeight: '600', flex: 1, marginLeft: spacing.sm }]}>
                  When do you usually shop?
                </Text>
              </View>

              <Text style={[theme.typography.footnote, { color: theme.textSecondary, marginBottom: spacing.sm }]}>
                Tap all days that apply.
              </Text>
              <View style={styles.chipWrap}>
                {WEEKDAY_SHORT.map((label, weekday0) => (
                  <WeekdayChip
                    key={label}
                    label={label}
                    weekday0={weekday0}
                    selected={selectedDays.includes(weekday0)}
                    onToggle={toggleWeekday}
                  />
                ))}
              </View>

              <Text
                style={[
                  theme.typography.subhead,
                  { color: theme.textSecondary, marginTop: spacing.lg, marginBottom: spacing.sm },
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
                  theme.typography.caption2,
                  { color: theme.textSecondary, marginTop: spacing.md, lineHeight: 16 },
                ]}
              >
                You can turn on notifications later in Settings. Skipping may still show Apple&apos;s permission
                prompt once.
              </Text>
            </>
          )}
        </View>
      </OnboardingStagger>
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
  benefitRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  benefitCard: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.sm,
    minHeight: 108,
  },
  benefitIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formCard: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  bellCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
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
