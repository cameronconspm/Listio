import type { ZoneKey } from './models';

export type ShoppingMode = 'plan' | 'shop';

export type MealScheduleConfig = {
  startDate: string;
  length: 1 | 2 | 3 | 4 | 5 | 6 | 7;
};

/** Mirrors `RecentItem` in recentItemsStore (kept here to avoid circular imports). */
export type RecentItemPreferenceSnapshot = {
  normalized_name: string;
  display_name: string;
  last_used_at: number;
  last_unit?: string;
};

export type UserPreferencesPayload = {
  /** Active household for synced list/meals/recipes/stores. */
  currentHouseholdId?: string;
  /** First-launch onboarding completion (sync users). */
  onboarding?: {
    completedVersion?: number;
    completedAt?: string;
  };
  shoppingMode?: ShoppingMode;
  mealScheduleConfig?: MealScheduleConfig;
  location?: {
    suggestNearestStore: boolean;
    useCurrentLocation: boolean;
    improveSuggestions: boolean;
    /** Min meters user must move before nearest-store suggestion can show again (default 150). */
    nearestSuggestMinMoveM?: number;
    /** When true, only run nearest-store GPS when List is in Shop mode. Default off when unset. */
    suggestNearestStoreOnlyInShopMode?: boolean;
    /** ISO time until which nearest-store banner is suppressed ("not today"). */
    nearestSuggestSnoozeUntilIso?: string | null;
  };
  /** Recipes tab filter/sort (cross-device when sync is on). */
  recipesUi?: {
    filter?: string;
    sort?: string;
  };
  /** List tab section collapse + filter. */
  listUi?: {
    collapsedZoneKeys?: ZoneKey[];
    filterZone?: ZoneKey | 'all';
    /** Custom section order when store-based layouts are disabled. */
    zoneOrder?: ZoneKey[];
  };
  /** Meals tab last selected day in ISO date string (yyyy-mm-dd). */
  mealsUi?: {
    lastSelectedDate?: string;
  };
  appearance?: {
    selectedTheme?: 'system' | 'light' | 'dark';
    largerText?: boolean;
    strongerContrast?: boolean;
  };
  units?: {
    unitSystem: string;
    convertRecipeUnits: boolean;
    preferShorthand: boolean;
    showUnitPickerSuggestions: boolean;
    defaultQuantityToOne: boolean;
    rememberLastUnit: boolean;
  };
  /** HH:mm 24h in the user's local timezone (device). */
  notifications?: {
    /** Legacy boolean — kept for backwards compatibility. New writes set `mealReminderMode` too. */
    mealReminders: boolean;
    /**
     * Cadence for meal nudges:
     * - `daily`: one generic "meal prep" reminder every day at `mealReminderTime`.
     * - `planned_only`: one "Tonight: <meal>" reminder per upcoming day that has a planned meal.
     * - `off`: no meal nudges at all.
     * When omitted, falls back to `mealReminders ? 'planned_only' : 'off'` so existing
     * users don't get noisier on upgrade.
     */
    mealReminderMode?: 'daily' | 'planned_only' | 'off';
    /** Sunday-morning preview of the week's planned meals (engagement nudge). */
    weeklyPreview?: boolean;
    /** Weekly nudge surfacing a saved-but-not-recently-cooked recipe (engagement nudge). */
    recipeSpotlight?: boolean;
    shoppingReminders: boolean;
    weeklyPlanningReminders: boolean;
    householdActivity: boolean;
    sharedUpdates: boolean;
    productAnnouncements: boolean;
    /** Only `push` is implemented; `email` / `both` reserved for future backend. */
    notificationStyle: 'push' | 'email' | 'both';
    /** Mute local/scheduled alerts during this window (interpreted in local time). */
    quietHours?: {
      enabled: boolean;
      /** HH:mm */
      start: string;
      /** HH:mm */
      end: string;
    };
    /** Default 17:00 — meal prep / shopping-for-meals nudge. */
    mealReminderTime?: string;
    /** Default 10:00 — reminder to review list before a trip. */
    shoppingReminderTime?: string;
    /** 0 = Sunday … 6 = Saturday. Default 0. */
    weeklyPlanningWeekday?: number;
    /** Default 10:00 — weekly planning nudge. */
    weeklyPlanningTime?: string;
    /** 0 = Sunday … 6 = Saturday; used when personalized shopping reminders are on. */
    shoppingWeekdays?: number[];
    /** Typical time of store trips — maps to reminder offsets. */
    shoppingTimeBucket?: 'morning' | 'midday' | 'evening';
    /** When true and `shoppingWeekdays` is non-empty, use weekly prep + day-of schedules instead of daily shopping time. */
    usePersonalizedShoppingReminders?: boolean;
    /** Lightweight counters for frequency caps (non-transactional nudges per ISO week). */
    notificationAnalytics?: {
      lastPermissionPromptAt?: string;
      lastOpenedFromNotificationAt?: string;
      disabledSystemNotificationsAt?: string;
      /** Week bucket `YYYY-MM-DD` (Monday) for cap resets. */
      nonTransactionalWeekKey?: string;
      nonTransactionalCount?: number;
      /** Same week bucket as above — avoids double-counting when rescheduling. */
      weeklyEngagementScheduledWeekKey?: string;
    };
  };
  /** Capped mirror of local recent items when sync is on. */
  recentItems?: RecentItemPreferenceSnapshot[];
};
