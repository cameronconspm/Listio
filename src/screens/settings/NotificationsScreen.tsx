import React, { useState, useEffect, useCallback } from 'react';
import { Text, StyleSheet, ScrollView, Alert, View } from 'react-native';
import { useTheme } from '../../design/ThemeContext';
import { useSettingsScrollHandler } from '../../navigation/NavigationChromeScrollContext';
import { Screen } from '../../components/ui/Screen';
import { useSettingsScrollInsets } from './settingsScrollLayout';
import { ListSection } from '../../components/ui/ListSection';
import { SettingsToggleRow } from '../../components/settings/SettingsToggleRow';
import { SegmentedPillControl } from '../../ui/components/SegmentedPillControl/SegmentedPillControl';
import {
  fetchUserPreferences,
  patchUserPreferences,
  type UserPreferencesPatch,
} from '../../services/userPreferencesService';
import { isSyncEnabled } from '../../services/supabaseClient';
import {
  mergeNotificationDefaults,
  normalizeShoppingWeekdays,
  resolveMealReminderMode,
  shouldUsePersonalizedShoppingSchedule,
  type MealReminderMode,
} from '../../services/notificationSchedulingDefaults';
import { requestNotificationPermissionsPrompting } from '../../services/notificationSchedulingService';
import { refreshDynamicNotifications } from '../../services/notificationRefreshService';
import { registerAndSyncPushToken } from '../../services/pushTokenService';
import { logNotificationMetric } from '../../services/notificationAnalyticsService';
import { OnboardingShoppingRhythmFeatured } from '../../components/onboarding/OnboardingShoppingRhythmFeatured';
import type { ShoppingTimeBucket } from '../../services/notificationTimeUtils';
import { spacing } from '../../design/spacing';

function notificationsMasterOn(
  n: NonNullable<ReturnType<typeof mergeNotificationDefaults>>
): boolean {
  return (
    resolveMealReminderMode(n) !== 'off' ||
    n.shoppingReminders ||
    n.weeklyPlanningReminders ||
    n.weeklyPreview === true ||
    n.recipeSpotlight === true ||
    n.productAnnouncements
  );
}

export function NotificationsScreen() {
  const onScroll = useSettingsScrollHandler();
  const scrollInsets = useSettingsScrollInsets();
  const theme = useTheme();
  const [notificationsOn, setNotificationsOn] = useState(true);
  const [usePersonalized, setUsePersonalized] = useState(true);
  const [shoppingWeekdays, setShoppingWeekdays] = useState<number[]>([]);
  const [shoppingTimeBucket, setShoppingTimeBucket] = useState<ShoppingTimeBucket>('evening');
  const [mealMode, setMealMode] = useState<MealReminderMode>('planned_only');
  const [weeklyPreview, setWeeklyPreview] = useState(false);
  const [recipeSpotlight, setRecipeSpotlight] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!isSyncEnabled()) return;
      try {
        const p = await fetchUserPreferences();
        if (!mounted) return;
        const n = mergeNotificationDefaults(p.notifications);
        setNotificationsOn(notificationsMasterOn(n));
        const days = normalizeShoppingWeekdays(n.shoppingWeekdays);
        setShoppingWeekdays(days);
        setShoppingTimeBucket(n.shoppingTimeBucket ?? 'evening');
        setUsePersonalized(shouldUsePersonalizedShoppingSchedule(n));
        setMealMode(resolveMealReminderMode(n));
        setWeeklyPreview(n.weeklyPreview === true);
        setRecipeSpotlight(n.recipeSpotlight === true);
      } catch {
        // keep default
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const syncSchedule = useCallback(async () => {
    await refreshDynamicNotifications();
    if (isSyncEnabled()) await registerAndSyncPushToken();
  }, []);

  const patchNotif = useCallback(
    async (patch: Partial<NonNullable<UserPreferencesPatch['notifications']>>) => {
      if (isSyncEnabled()) {
        try {
          await patchUserPreferences({ notifications: patch });
        } catch {
          // keep UI
        }
      }
      await syncSchedule();
    },
    [syncSchedule]
  );

  const ensurePermission = async (): Promise<boolean> => {
    void logNotificationMetric('permission_prompt');
    const ok = await requestNotificationPermissionsPrompting();
    if (!ok) {
      Alert.alert(
        'Notifications are off',
        'Turn on notifications for Listio in Settings to get reminders on this device.'
      );
    }
    return ok;
  };

  const onMasterToggle = async (enabled: boolean) => {
    const p = isSyncEnabled() ? await fetchUserPreferences() : {};
    const prev = mergeNotificationDefaults(p.notifications);
    const qh = prev.quietHours ?? { enabled: false, start: '22:00', end: '07:00' };
    const days = normalizeShoppingWeekdays(prev.shoppingWeekdays);

    if (enabled) {
      const ok = await ensurePermission();
      if (!ok) return;
      setNotificationsOn(true);
      setMealMode('planned_only');
      setWeeklyPreview(false);
      setRecipeSpotlight(false);
      await patchNotif({
        mealReminders: true,
        mealReminderMode: 'planned_only',
        shoppingReminders: true,
        weeklyPlanningReminders: false,
        weeklyPreview: false,
        recipeSpotlight: false,
        householdActivity: false,
        sharedUpdates: false,
        productAnnouncements: false,
        quietHours: { enabled: false, start: qh.start, end: qh.end },
        shoppingWeekdays: days.length > 0 ? days : [],
        shoppingTimeBucket: prev.shoppingTimeBucket ?? 'evening',
        usePersonalizedShoppingReminders: true,
      });
      setShoppingWeekdays(days.length > 0 ? days : []);
      setShoppingTimeBucket(prev.shoppingTimeBucket ?? 'evening');
      setUsePersonalized(true);
    } else {
      setNotificationsOn(false);
      setMealMode('off');
      setWeeklyPreview(false);
      setRecipeSpotlight(false);
      await patchNotif({
        mealReminders: false,
        mealReminderMode: 'off',
        shoppingReminders: false,
        weeklyPlanningReminders: false,
        weeklyPreview: false,
        recipeSpotlight: false,
        householdActivity: false,
        sharedUpdates: false,
        productAnnouncements: false,
        quietHours: { enabled: false, start: qh.start, end: qh.end },
      });
    }
  };

  const onPersonalizedToggle = async (enabled: boolean) => {
    if (enabled) {
      const ok = await ensurePermission();
      if (!ok) return;
    }
    setUsePersonalized(enabled);
    await patchNotif({ usePersonalizedShoppingReminders: enabled });
  };

  const onChangeShoppingDays = (days: number[]) => {
    setShoppingWeekdays(days);
    void patchNotif({ shoppingWeekdays: days });
  };

  const onChangeBucket = (bucket: ShoppingTimeBucket) => {
    setShoppingTimeBucket(bucket);
    void patchNotif({ shoppingTimeBucket: bucket });
  };

  const onChangeMealMode = async (mode: MealReminderMode) => {
    if (mode !== 'off') {
      const ok = await ensurePermission();
      if (!ok) return;
    }
    setMealMode(mode);
    await patchNotif({ mealReminderMode: mode, mealReminders: mode !== 'off' });
  };

  const onToggleWeeklyPreview = async (v: boolean) => {
    if (v) {
      const ok = await ensurePermission();
      if (!ok) return;
    }
    setWeeklyPreview(v);
    await patchNotif({ weeklyPreview: v });
  };

  const onToggleRecipeSpotlight = async (v: boolean) => {
    if (v) {
      const ok = await ensurePermission();
      if (!ok) return;
    }
    setRecipeSpotlight(v);
    await patchNotif({ recipeSpotlight: v });
  };

  return (
    <Screen padded safeTop={false} safeBottom={false}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: scrollInsets.paddingTop,
            paddingBottom: scrollInsets.paddingBottom,
          },
        ]}
        onScroll={onScroll}
        scrollEventThrottle={scrollInsets.scrollEventThrottle}
        contentInsetAdjustmentBehavior={scrollInsets.contentInsetBehavior}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.infoBlock}>
          <Text style={[theme.typography.footnote, { color: theme.textSecondary }]}>
            Reminders show on this phone. Turn them all off with the switch below. Email reminders aren’t available
            yet.
          </Text>
        </View>
        <ListSection title="Notifications" titleVariant="small" glass={false} style={styles.section}>
          <SettingsToggleRow
            title="Allow notifications"
            value={notificationsOn}
            onValueChange={(v) => {
              void onMasterToggle(v);
            }}
          />
        </ListSection>

        {isSyncEnabled() && notificationsOn ? (
          <>
            <ListSection title="Meal reminders" titleVariant="small" glass={false} style={styles.section}>
              <View style={styles.cadenceWrap}>
                <Text
                  style={[
                    theme.typography.footnote,
                    { color: theme.textSecondary, marginBottom: theme.spacing.sm },
                  ]}
                >
                  Choose how often you want a heads-up about meals.
                </Text>
                <SegmentedPillControl<MealReminderMode>
                  segments={[
                    { key: 'daily', label: 'Daily' },
                    { key: 'planned_only', label: 'Planned days' },
                    { key: 'off', label: 'Off' },
                  ]}
                  value={mealMode}
                  onChange={(m) => {
                    void onChangeMealMode(m);
                  }}
                />
                <Text
                  style={[
                    theme.typography.footnote,
                    { color: theme.textSecondary, marginTop: theme.spacing.sm, lineHeight: 18 },
                  ]}
                >
                  {mealMode === 'daily'
                    ? 'A short nudge every evening — handy if you cook ad-hoc.'
                    : mealMode === 'planned_only'
                    ? 'Only on days with a meal planned. Quietest, most useful.'
                    : 'No meal reminders. You can still get shopping nudges below.'}
                </Text>
              </View>
            </ListSection>

            <ListSection title="Engaging extras" titleVariant="small" glass={false} style={styles.section}>
              <SettingsToggleRow
                title="Weekly preview"
                subtitle="Sunday morning rundown of this week’s planned meals."
                value={weeklyPreview}
                onValueChange={(v) => {
                  void onToggleWeeklyPreview(v);
                }}
              />
              <SettingsToggleRow
                title="Recipe spotlight"
                subtitle="A mid-week nudge surfacing a saved recipe you haven’t cooked recently."
                value={recipeSpotlight}
                onValueChange={(v) => {
                  void onToggleRecipeSpotlight(v);
                }}
              />
            </ListSection>

            <ListSection title="Shopping schedule" titleVariant="small" glass={false} style={styles.section}>
              <SettingsToggleRow
                title="Match my shopping days"
                subtitle="Reminders match the shopping days and times you choose"
                value={usePersonalized}
                onValueChange={(v) => {
                  void onPersonalizedToggle(v);
                }}
              />
              {usePersonalized ? (
                <OnboardingShoppingRhythmFeatured
                  syncEnabled
                  compact
                  selectedDays={shoppingWeekdays}
                  onChangeDays={onChangeShoppingDays}
                  timeBucket={shoppingTimeBucket}
                  onChangeBucket={onChangeBucket}
                />
              ) : null}
            </ListSection>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {},
  section: { marginBottom: spacing.lg },
  infoBlock: { paddingHorizontal: spacing.md, marginBottom: spacing.md },
  cadenceWrap: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
});
