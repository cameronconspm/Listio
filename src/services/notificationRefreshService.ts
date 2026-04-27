/**
 * Builds a `LocalDataContext` from current meals/recipes/list state and runs
 * the scheduler. This is the only place that touches data services on behalf
 * of notifications — keeps the scheduler itself testable in isolation.
 *
 * Called from `useNotificationBootstrap` (cold start + AppState active) and
 * after preference changes. Designed to be cheap-to-call repeatedly: it
 * never re-fetches more than the next 7 days of meals + the current list +
 * a recipes list, all of which are tiny.
 */

import { fetchUserPreferences } from './userPreferencesService';
import { getUserId, isSyncEnabled } from './supabaseClient';
import { getMealsByDateRange } from './mealService';
import { getRecipes } from './recipeService';
import { fetchListItems } from './listService';
import { rescheduleLocalNotificationsFromPreferences } from './notificationSchedulingService';
import {
  EMPTY_LOCAL_DATA_CONTEXT,
  todayIsoLocal,
  type LocalDataContext,
} from './notificationContentService';
import { mergeNotificationDefaults, normalizeShoppingWeekdays } from './notificationSchedulingDefaults';
import { logger } from '../utils/logger';

/**
 * Pull the next 7 days of meals + saved recipes + open list count into a
 * snapshot the content service can render bodies from. Failures degrade to
 * an empty context so scheduling still runs (it just produces null content
 * for kinds that need data, which the planner gracefully drops).
 */
export async function buildLocalDataContext(): Promise<LocalDataContext> {
  const today = todayIsoLocal();
  if (!isSyncEnabled()) {
    return { ...EMPTY_LOCAL_DATA_CONTEXT, today };
  }

  const uid = await getUserId().catch(() => null);
  if (!uid) {
    return { ...EMPTY_LOCAL_DATA_CONTEXT, today };
  }

  const start = today;
  const end = isoDateOffset(today, 6);

  const [mealsRes, recipesRes, listRes] = await Promise.allSettled([
    getMealsByDateRange(uid, start, end),
    getRecipes(uid),
    fetchListItems(uid),
  ]);

  const meals =
    mealsRes.status === 'fulfilled'
      ? mealsRes.value.map((m) => ({
          meal_date: m.meal_date,
          name: m.name,
          meal_slot: m.meal_slot,
        }))
      : [];

  const recipes =
    recipesRes.status === 'fulfilled'
      ? recipesRes.value.map((r) => ({
          id: r.id,
          name: r.name,
          last_used_at: r.last_used_at ?? null,
          created_at: r.created_at,
        }))
      : [];

  const items = listRes.status === 'fulfilled' ? listRes.value : [];
  const unchecked = items.filter((i) => !i.is_checked);
  const aisleSet = new Set<string>();
  for (const i of unchecked) {
    if (i.zone_key) aisleSet.add(i.zone_key);
  }

  return {
    today,
    meals,
    recipes,
    list: {
      totalCount: items.length,
      uncheckedCount: unchecked.length,
      aisleCount: aisleSet.size,
    },
  };
}

/**
 * One-shot refresh: fetch prefs, build context, reschedule. Safe to call
 * from any UI surface (settings change, foreground transition, mutation).
 * Errors are logged but never thrown — notifications never block the UI.
 */
export async function refreshDynamicNotifications(): Promise<void> {
  try {
    const prefs = isSyncEnabled() ? await fetchUserPreferences() : {};
    const ctx = await buildLocalDataContext();
    const merged = mergeNotificationDefaults(prefs.notifications);
    const enriched: LocalDataContext = {
      ...ctx,
      shoppingWeekdays: normalizeShoppingWeekdays(merged.shoppingWeekdays),
    };
    await rescheduleLocalNotificationsFromPreferences(prefs, enriched);
  } catch (e) {
    logger.warnRelease('refreshDynamicNotifications failed', e);
  }
}

function isoDateOffset(iso: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const mo = d.getMonth() + 1;
  const da = d.getDate();
  return `${y}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`;
}
