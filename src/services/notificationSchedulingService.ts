import { Platform } from 'react-native';
import type { UserPreferencesPayload } from '../types/preferences';
import {
  adjustHourMinuteOutOfQuietHours,
  computePrepWeekday0,
  getWeekBucketKey,
  mapShoppingTimeBucketToTripHour,
  parseHmToMinutes,
  primaryShoppingWeekday0,
  subtractHoursClamped,
  type QuietWindow,
} from './notificationTimeUtils';
import { patchUserPreferences } from './userPreferencesService';
import {
  DEFAULT_MEAL_TIME,
  DEFAULT_SHOPPING_TIME,
  DEFAULT_WEEKLY_TIME,
  DEFAULT_WEEKLY_WEEKDAY,
  mealDailyWeekdayNotificationId,
  mergeNotificationDefaults,
  NOTIFICATION_IDS,
  NOTIFICATION_ID_PREP_BEFORE_SHOP,
  PERSONALIZED_PREP_TIME,
  resolveMealReminderMode,
  shopWeekdayNotificationId,
  shouldUsePersonalizedShoppingSchedule,
  tonightsMealNotificationId,
} from './notificationSchedulingDefaults';
import {
  buildContent,
  EMPTY_LOCAL_DATA_CONTEXT,
  todayIsoLocal,
  type BuiltContent,
  type ContentTarget,
  type LocalDataContext,
} from './notificationContentService';
import {
  planNotifications,
  type NotificationKind,
  type PlannedNotification,
  type WhenSpec,
} from './notificationCollisionPlanner';

export {
  DEFAULT_MEAL_TIME,
  DEFAULT_SHOPPING_TIME,
  DEFAULT_WEEKLY_TIME,
  DEFAULT_WEEKLY_WEEKDAY,
  MAX_NON_TRANSACTIONAL_NUDGES_PER_WEEK,
  mergeNotificationDefaults,
  normalizeShoppingWeekdays,
  NOTIFICATION_IDS,
  shouldUsePersonalizedShoppingSchedule,
} from './notificationSchedulingDefaults';

const ANDROID_CHANNEL_ID = 'listio-default';

function loadNotifications(): typeof import('expo-notifications') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- defer native module until scheduling runs
  return require('expo-notifications') as typeof import('expo-notifications');
}

function parseHourMinute(hm: string): { hour: number; minute: number } | null {
  const m = parseHmToMinutes(hm);
  if (m === null) return null;
  return { hour: Math.floor(m / 60) % 24, minute: m % 60 };
}

/** Expo weekly: weekday 1 = Sunday … 7 = Saturday. Our prefs: 0 = Sunday … 6 = Saturday. */
function expoWeekdayFromPrefs(weekday0: number): number {
  const clamped = Math.max(0, Math.min(6, Math.floor(weekday0)));
  return clamped + 1;
}

export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const Notifications = loadNotifications();
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Listio',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF231F7C',
  });
}

/** Cancels every scheduled notification whose identifier starts with `listio-`. */
export async function cancelAllListioSchedules(): Promise<void> {
  const Notifications = loadNotifications();
  const all = await Notifications.getAllScheduledNotificationsAsync();
  for (const req of all) {
    const id = req.identifier ?? '';
    if (id.startsWith('listio-')) {
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    }
  }
}

type NotificationsModule = ReturnType<typeof loadNotifications>;

type MergedNotifications = ReturnType<typeof mergeNotificationDefaults>;

function androidChannelExtras(_Notifications: NotificationsModule) {
  return Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {};
}

/** Internal candidate carries both scheduling info and the content target so we can build bodies after planning. */
type Candidate = PlannedNotification & {
  contentTarget: ContentTarget;
};

function adjusted(hm: { hour: number; minute: number }, quiet: QuietWindow | undefined) {
  return adjustHourMinuteOutOfQuietHours(hm.hour, hm.minute, quiet);
}

/**
 * Build the candidate set from preferences + local data. Each candidate
 * carries its content target so post-planning we can resolve the body.
 */
function collectCandidates(
  n: MergedNotifications,
  quiet: QuietWindow | undefined,
  ctx: LocalDataContext
): Candidate[] {
  const out: Candidate[] = [];
  const mealMode = resolveMealReminderMode(n);

  // Meal reminders ----------------------------------------------------------
  if (mealMode !== 'off') {
    const mealHm = parseHourMinute(n.mealReminderTime ?? DEFAULT_MEAL_TIME);
    if (mealHm) {
      const adj = adjusted(mealHm, quiet);
      if (mealMode === 'daily') {
        // Pre-explode to per-weekday so a single shopping-day collision doesn't blank the whole week.
        for (let w = 0; w < 7; w += 1) {
          out.push(weeklyCandidate({
            identifier: mealDailyWeekdayNotificationId(w),
            kind: 'mealDaily',
            weekday0: w,
            hour: adj.hour,
            minute: adj.minute,
            contentTarget: { kind: 'mealDaily' },
          }));
        }
      } else {
        // planned_only: one one-shot per upcoming day with a planned meal.
        for (const meal of upcomingPrimaryMealsByDate(ctx)) {
          const reminderDate = localDateAt(meal.meal_date, adj.hour, adj.minute);
          if (!reminderDate || reminderDate.getTime() <= Date.now()) continue;
          out.push({
            identifier: tonightsMealNotificationId(meal.meal_date),
            kind: 'tonightsMeal',
            when: { type: 'oneShot', date: reminderDate },
            contentTarget: { kind: 'tonightsMeal', date: meal.meal_date },
          });
        }
      }
    }
  }

  // Shopping reminders -----------------------------------------------------
  if (n.shoppingReminders) {
    const personalized = shouldUsePersonalizedShoppingSchedule(n);
    if (personalized) {
      const weekdays = n.shoppingWeekdays ?? [];
      const primary = primaryShoppingWeekday0(weekdays);
      if (primary !== null) {
        const prepDay0 = computePrepWeekday0(primary);
        const prepHm = parseHourMinute(PERSONALIZED_PREP_TIME);
        if (prepHm) {
          const adj = adjusted(prepHm, quiet);
          out.push(weeklyCandidate({
            identifier: NOTIFICATION_ID_PREP_BEFORE_SHOP,
            kind: 'prepBeforeShop',
            weekday0: prepDay0,
            hour: adj.hour,
            minute: adj.minute,
            contentTarget: { kind: 'prepBeforeShop' },
          }));
        }
      }

      const bucket = n.shoppingTimeBucket ?? 'evening';
      const tripHour = mapShoppingTimeBucketToTripHour(bucket);
      const remindHour = subtractHoursClamped(tripHour, 1);
      const adj = adjusted({ hour: remindHour, minute: 0 }, quiet);
      for (const wd of weekdays) {
        out.push(weeklyCandidate({
          identifier: shopWeekdayNotificationId(wd),
          kind: 'shoppingDay',
          weekday0: wd,
          hour: adj.hour,
          minute: adj.minute,
          contentTarget: { kind: 'shoppingDay' },
        }));
      }
    } else {
      const shopHm = parseHourMinute(n.shoppingReminderTime ?? DEFAULT_SHOPPING_TIME);
      if (shopHm) {
        const adj = adjusted(shopHm, quiet);
        // Daily generic shopping reminder — pre-explode for partial-survival.
        for (let w = 0; w < 7; w += 1) {
          out.push(weeklyCandidate({
            identifier: `${NOTIFICATION_IDS.shopping}-wd-${w}`,
            kind: 'shoppingDay',
            weekday0: w,
            hour: adj.hour,
            minute: adj.minute,
            contentTarget: { kind: 'shoppingDay' },
          }));
        }
      }
    }
  }

  // Engagement nudges (capped per-week by the planner) ---------------------
  if (n.weeklyPreview) {
    const adj = adjusted({ hour: 8, minute: 30 }, quiet);
    out.push(weeklyCandidate({
      identifier: NOTIFICATION_IDS.weeklyPreview,
      kind: 'weeklyPreview',
      weekday0: 0, // Sunday morning
      hour: adj.hour,
      minute: adj.minute,
      contentTarget: { kind: 'weeklyPreview' },
    }));
  }

  if (n.recipeSpotlight) {
    const adj = adjusted({ hour: 16, minute: 0 }, quiet);
    out.push(weeklyCandidate({
      identifier: NOTIFICATION_IDS.recipeSpotlight,
      kind: 'recipeSpotlight',
      weekday0: 3, // Wednesday afternoon — mid-week slump
      hour: adj.hour,
      minute: adj.minute,
      contentTarget: { kind: 'recipeSpotlight' },
    }));
  }

  if (n.weeklyPlanningReminders) {
    const weeklyHm = parseHourMinute(n.weeklyPlanningTime ?? DEFAULT_WEEKLY_TIME);
    if (weeklyHm) {
      const adj = adjusted(weeklyHm, quiet);
      out.push(weeklyCandidate({
        identifier: NOTIFICATION_IDS.weekly,
        kind: 'weeklyPlanning',
        weekday0: n.weeklyPlanningWeekday ?? DEFAULT_WEEKLY_WEEKDAY,
        hour: adj.hour,
        minute: adj.minute,
        contentTarget: { kind: 'weeklyPlanning' },
      }));
    }
  }

  return out;
}

function weeklyCandidate(args: {
  identifier: string;
  kind: NotificationKind;
  weekday0: number;
  hour: number;
  minute: number;
  contentTarget: ContentTarget;
}): Candidate {
  const when: WhenSpec = {
    type: 'weekly',
    weekday0: args.weekday0,
    hour: args.hour,
    minute: args.minute,
  };
  return {
    identifier: args.identifier,
    kind: args.kind,
    when,
    contentTarget: args.contentTarget,
  };
}

function upcomingPrimaryMealsByDate(ctx: LocalDataContext): { meal_date: string; name: string }[] {
  if (!ctx.today || ctx.meals.length === 0) return [];
  // Prefer the dinner-ish primary meal per date — same heuristic as content service.
  const seen = new Map<string, { meal_date: string; name: string }>();
  for (const m of ctx.meals) {
    if (!seen.has(m.meal_date)) seen.set(m.meal_date, { meal_date: m.meal_date, name: m.name });
  }
  return [...seen.values()].sort((a, b) => a.meal_date.localeCompare(b.meal_date));
}

function localDateAt(iso: string, hour: number, minute: number): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hour, minute, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

function whenSpecToTrigger(
  Notifications: NotificationsModule,
  when: WhenSpec
): import('expo-notifications').NotificationTriggerInput {
  if (when.type === 'daily') {
    return {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: when.hour,
      minute: when.minute,
    };
  }
  if (when.type === 'weekly') {
    return {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: expoWeekdayFromPrefs(when.weekday0),
      hour: when.hour,
      minute: when.minute,
    };
  }
  return {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date: when.date,
  };
}

async function maybeBumpWeeklyEngagementAnalytics(
  scheduledKinds: ReadonlySet<NotificationKind>,
  n: MergedNotifications
): Promise<void> {
  if (!scheduledKinds.has('weeklyPlanning')) return;
  const weekKey = getWeekBucketKey();
  const a = n.notificationAnalytics;
  const alreadyScheduledThisWeek = a?.weeklyEngagementScheduledWeekKey === weekKey;
  if (alreadyScheduledThisWeek) return;
  const countThisWeek =
    a?.nonTransactionalWeekKey === weekKey ? (a.nonTransactionalCount ?? 0) : 0;
  try {
    await patchUserPreferences({
      notifications: {
        notificationAnalytics: {
          nonTransactionalWeekKey: weekKey,
          nonTransactionalCount: countThisWeek + 1,
          weeklyEngagementScheduledWeekKey: weekKey,
        },
      },
    });
  } catch {
    // analytics is best-effort; never block scheduling
  }
}

/**
 * Cancel + reschedule all Listio local notifications based on prefs and a
 * snapshot of local data. The snapshot is optional — when omitted, an empty
 * one is used (scheduling still works; bodies fall back to generic copy).
 *
 * Push-style prefs (`notificationStyle === 'email'`) skip local schedules.
 */
export async function rescheduleLocalNotificationsFromPreferences(
  prefs: UserPreferencesPayload,
  ctx?: LocalDataContext
): Promise<void> {
  const Notifications = loadNotifications();
  await ensureAndroidChannel();
  await cancelAllListioSchedules();

  const n = mergeNotificationDefaults(prefs.notifications);
  if (n.notificationStyle === 'email') {
    return;
  }

  const perm = await Notifications.getPermissionsAsync();
  if (perm.status !== 'granted') return;

  const localCtx: LocalDataContext = ctx ?? { ...EMPTY_LOCAL_DATA_CONTEXT, today: todayIsoLocal() };

  const candidates = collectCandidates(n, n.quietHours, localCtx);
  // Resolve content first so candidates with null bodies (smart-skip) drop out before planning.
  const withContent: { cand: Candidate; content: BuiltContent }[] = [];
  for (const cand of candidates) {
    const content = buildContent(cand.contentTarget, localCtx);
    if (!content) continue;
    withContent.push({ cand, content });
  }

  const planned = planNotifications(withContent.map((x) => x.cand));
  const plannedIds = new Set(planned.map((p) => p.identifier));
  const survivors = withContent.filter((x) => plannedIds.has(x.cand.identifier));

  const scheduledKinds = new Set<NotificationKind>();
  for (const { cand, content } of survivors) {
    await Notifications.scheduleNotificationAsync({
      identifier: cand.identifier,
      content: {
        title: content.title,
        body: content.body,
        data: content.data,
        sound: true,
        ...androidChannelExtras(Notifications),
      },
      trigger: whenSpecToTrigger(Notifications, cand.when),
    });
    scheduledKinds.add(cand.kind);
  }

  await maybeBumpWeeklyEngagementAnalytics(scheduledKinds, n);
}

export async function requestNotificationPermissionsPrompting(): Promise<boolean> {
  const Notifications = loadNotifications();
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}
