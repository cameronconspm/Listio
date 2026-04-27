import type { UserPreferencesPayload } from '../types/preferences';
import type { ShoppingTimeBucket } from './notificationTimeUtils';

export const NOTIFICATION_IDS = {
  meal: 'listio-meal-daily',
  shopping: 'listio-shopping-daily',
  weekly: 'listio-weekly-planning',
  weeklyPreview: 'listio-weekly-preview',
  recipeSpotlight: 'listio-recipe-spotlight',
} as const;

/** Fixed evening nudge — three days before primary shopping day (personalized path). */
export const NOTIFICATION_ID_PREP_BEFORE_SHOP = 'listio-prep-before-shop';

export function shopWeekdayNotificationId(weekday0: number): string {
  return `listio-shop-wd-${weekday0}`;
}

/** Per-date "Tonight: <meal>" nudge id (planned_only mode). */
export function tonightsMealNotificationId(dateIso: string): string {
  return `listio-tonights-meal-${dateIso}`;
}

/** Per-weekday split of the legacy daily meal reminder when collisions force it weekly. */
export function mealDailyWeekdayNotificationId(weekday0: number): string {
  return `listio-meal-daily-wd-${weekday0}`;
}

export const PERSONALIZED_PREP_TIME = '19:30';

/** Non-transactional nudges (weekly planning + future product) per week — utility reminders excluded. */
export const MAX_NON_TRANSACTIONAL_NUDGES_PER_WEEK = 3;

export const DEFAULT_MEAL_TIME = '17:00';
export const DEFAULT_SHOPPING_TIME = '10:00';
export const DEFAULT_WEEKLY_TIME = '10:00';
export const DEFAULT_WEEKLY_WEEKDAY = 0; // 0 = Sunday (matches onboarding)

function normalizeNotificationStyle(s: string | undefined): 'push' | 'email' | 'both' {
  const x = (s ?? 'push').toLowerCase();
  if (x === 'email') return 'email';
  if (x === 'both') return 'both';
  return 'push';
}

export function normalizeShoppingWeekdays(raw: number[] | undefined): number[] {
  if (!raw?.length) return [];
  const s = new Set<number>();
  for (const d of raw) {
    if (typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 6) {
      s.add(d);
    }
  }
  return [...s].sort((a, b) => a - b);
}

function normalizeShoppingTimeBucket(b: string | undefined): ShoppingTimeBucket {
  const x = (b ?? 'evening').toLowerCase();
  if (x === 'morning' || x === 'midday' || x === 'evening') return x;
  return 'evening';
}

export type MealReminderMode = 'daily' | 'planned_only' | 'off';

/**
 * Resolve `mealReminderMode` from the new field plus the legacy `mealReminders`
 * boolean. Idempotent and quieter-by-default: a legacy `true` becomes
 * `planned_only` rather than `daily` so existing users get *fewer* pings on
 * upgrade, never more.
 */
export function resolveMealReminderMode(
  n: UserPreferencesPayload['notifications'] | undefined
): MealReminderMode {
  const explicit = n?.mealReminderMode;
  if (explicit === 'daily' || explicit === 'planned_only' || explicit === 'off') {
    return explicit;
  }
  if (n?.mealReminders === false) return 'off';
  return 'planned_only';
}

export function mergeNotificationDefaults(
  n: UserPreferencesPayload['notifications'] | undefined
): NonNullable<UserPreferencesPayload['notifications']> {
  const style = normalizeNotificationStyle(n?.notificationStyle as string | undefined);
  const shoppingWeekdays = normalizeShoppingWeekdays(n?.shoppingWeekdays);
  const shoppingTimeBucket = normalizeShoppingTimeBucket(n?.shoppingTimeBucket as string | undefined);
  const usePersonalizedShoppingReminders =
    shoppingWeekdays.length === 0 ? false : (n?.usePersonalizedShoppingReminders ?? true);
  const mealReminderMode = resolveMealReminderMode(n);

  return {
    mealReminders: n?.mealReminders ?? mealReminderMode !== 'off',
    mealReminderMode,
    weeklyPreview: n?.weeklyPreview ?? false,
    recipeSpotlight: n?.recipeSpotlight ?? false,
    shoppingReminders: n?.shoppingReminders ?? true,
    weeklyPlanningReminders: n?.weeklyPlanningReminders ?? false,
    householdActivity: n?.householdActivity ?? false,
    sharedUpdates: n?.sharedUpdates ?? false,
    productAnnouncements: n?.productAnnouncements ?? false,
    notificationStyle: style,
    quietHours: n?.quietHours ?? {
      enabled: false,
      start: '22:00',
      end: '07:00',
    },
    mealReminderTime: n?.mealReminderTime ?? DEFAULT_MEAL_TIME,
    shoppingReminderTime: n?.shoppingReminderTime ?? DEFAULT_SHOPPING_TIME,
    weeklyPlanningWeekday: n?.weeklyPlanningWeekday ?? DEFAULT_WEEKLY_WEEKDAY,
    weeklyPlanningTime: n?.weeklyPlanningTime ?? DEFAULT_WEEKLY_TIME,
    shoppingWeekdays,
    shoppingTimeBucket,
    usePersonalizedShoppingReminders,
    notificationAnalytics: n?.notificationAnalytics,
  };
}

/** After merge — personalized weekly shopping + prep instead of legacy daily shopping time. */
export function shouldUsePersonalizedShoppingSchedule(
  n: ReturnType<typeof mergeNotificationDefaults>
): boolean {
  const days = n.shoppingWeekdays ?? [];
  return n.usePersonalizedShoppingReminders === true && days.length > 0;
}
