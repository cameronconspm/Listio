/**
 * Pure notification content generator. Given a kind + a snapshot of local
 * data (meals, recipes, list), returns a `{title, body, data}` shape ready
 * for `Notifications.scheduleNotificationAsync`, or `null` to smart-skip
 * (e.g. tonightsMeal on a day with no planned meal).
 *
 * Kept dependency-free of expo / react-native so it can be unit-tested and
 * later reused server-side for push delivery (Phase 2).
 */

import type { MealSlot } from '../types/models';

const WEEKDAY_FULL = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export type LocalCtxMeal = {
  /** YYYY-MM-DD local. */
  meal_date: string;
  name: string;
  meal_slot: MealSlot;
};

export type LocalCtxRecipe = {
  id: string;
  name: string;
  /** ISO timestamp or null. */
  last_used_at: string | null;
  created_at?: string;
};

export type LocalCtxList = {
  /** All items, including checked. */
  totalCount: number;
  /** Items still to buy. */
  uncheckedCount: number;
  /** Distinct zones with at least one unchecked item. */
  aisleCount: number;
};

export type LocalDataContext = {
  /** Local YYYY-MM-DD for "today" — anchored once per refresh so all kinds agree. */
  today: string;
  meals: LocalCtxMeal[];
  recipes: LocalCtxRecipe[];
  list: LocalCtxList;
  /** Sunday=0…Saturday=6. Used for prepBeforeShop body wording. */
  shoppingWeekdays?: number[];
};

export type ContentTarget =
  | { kind: 'mealDaily' | 'weeklyPreview' | 'recipeSpotlight' | 'weeklyPlanning' | 'prepBeforeShop' | 'shoppingDay' }
  | { kind: 'tonightsMeal'; date: string };

export type BuiltContent = {
  title: string;
  body: string;
  data: { navigateTo: 'meals' | 'list' | 'recipes' };
};

export const EMPTY_LOCAL_DATA_CONTEXT: LocalDataContext = {
  today: '',
  meals: [],
  recipes: [],
  list: { totalCount: 0, uncheckedCount: 0, aisleCount: 0 },
};

export function buildContent(target: ContentTarget, ctx: LocalDataContext): BuiltContent | null {
  switch (target.kind) {
    case 'mealDaily':
      return {
        title: 'Meal prep',
        body: "What's for dinner tonight? Tap to plan or check your list.",
        data: { navigateTo: 'meals' },
      };
    case 'tonightsMeal': {
      const meal = pickPrimaryMealForDate(ctx.meals, target.date);
      if (!meal) return null;
      const items = ctx.list.uncheckedCount;
      const tail =
        items > 0
          ? ` ${items} item${items === 1 ? '' : 's'} still on your list.`
          : '';
      return {
        title: 'Tonight',
        body: `${meal.name}.${tail}`.trim(),
        data: { navigateTo: 'meals' },
      };
    }
    case 'weeklyPreview': {
      const upcoming = upcomingWeekMealsByDate(ctx);
      if (upcoming.length === 0) return null;
      const head = upcoming
        .slice(0, 3)
        .map((m) => `${WEEKDAY_SHORT[weekday0FromIso(m.meal_date)]} ${truncateName(m.name, 14)}`)
        .join(' \u00b7 ');
      const more = upcoming.length > 3 ? ` (+${upcoming.length - 3} more)` : '';
      return {
        title: 'This week',
        body: `${head}${more}. Tap to plan the rest.`,
        data: { navigateTo: 'meals' },
      };
    }
    case 'recipeSpotlight': {
      const pick = pickSpotlightRecipe(ctx);
      if (!pick) return null;
      const stale = staleSinceLabel(pick.last_used_at, pick.created_at, ctx.today);
      const tail = stale ? ` \u2014 ${stale}` : '';
      return {
        title: 'Recipe spotlight',
        body: `${pick.name}${tail}. Cook it this week?`,
        data: { navigateTo: 'recipes' },
      };
    }
    case 'shoppingDay': {
      if (ctx.list.uncheckedCount === 0) return null;
      const items = ctx.list.uncheckedCount;
      const aisles = ctx.list.aisleCount;
      const aisleTail =
        aisles > 0 ? ` across ${aisles} aisle${aisles === 1 ? '' : 's'}` : '';
      return {
        title: 'Shopping list',
        body: `${items} item${items === 1 ? '' : 's'}${aisleTail} for your trip.`,
        data: { navigateTo: 'list' },
      };
    }
    case 'prepBeforeShop': {
      const dayLabel =
        ctx.shoppingWeekdays && ctx.shoppingWeekdays.length > 0
          ? WEEKDAY_FULL[Math.min(...ctx.shoppingWeekdays)]
          : 'your trip';
      const items = ctx.list.uncheckedCount;
      const body =
        items > 0
          ? `You shop ${dayLabel} \u2014 ${items} item${items === 1 ? '' : 's'} on the list so far.`
          : `You shop ${dayLabel} \u2014 your list is empty. Add what you need.`;
      return {
        title: 'Prep your list',
        body,
        data: { navigateTo: 'list' },
      };
    }
    case 'weeklyPlanning':
      return {
        title: 'Plan the week',
        body: 'Set meals and your list when it works for you.',
        data: { navigateTo: 'meals' },
      };
    default:
      return null;
  }
}

/** Dinner > custom > lunch > breakfast > dessert. Returns null when no meal that day. */
export function pickPrimaryMealForDate(
  meals: LocalCtxMeal[],
  dateIso: string
): LocalCtxMeal | null {
  const day = meals.filter((m) => m.meal_date === dateIso);
  if (day.length === 0) return null;
  const order: MealSlot[] = ['dinner', 'custom', 'lunch', 'breakfast', 'dessert'];
  for (const slot of order) {
    const found = day.find((m) => m.meal_slot === slot);
    if (found) return found;
  }
  return day[0] ?? null;
}

/** First meal per upcoming day (today + 6) sorted ascending. Picks dinner-ish via pickPrimaryMealForDate. */
export function upcomingWeekMealsByDate(ctx: LocalDataContext): LocalCtxMeal[] {
  if (!ctx.today) return [];
  const start = isoToDate(ctx.today);
  if (Number.isNaN(start.getTime())) return [];
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return toIsoDate(d);
  });
  const out: LocalCtxMeal[] = [];
  for (const iso of days) {
    const m = pickPrimaryMealForDate(ctx.meals, iso);
    if (m) out.push(m);
  }
  return out;
}

/** Recipe the user saved but hasn't cooked in 14+ days; null if pool too small. */
export function pickSpotlightRecipe(ctx: LocalDataContext): LocalCtxRecipe | null {
  if (ctx.recipes.length < 3) return null;
  if (!ctx.today) return null;
  const today = isoToDate(ctx.today);
  if (Number.isNaN(today.getTime())) return null;
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - 14);

  const sorted = [...ctx.recipes].sort((a, b) => {
    const aRef = a.last_used_at ?? a.created_at ?? '';
    const bRef = b.last_used_at ?? b.created_at ?? '';
    return aRef.localeCompare(bRef);
  });

  for (const r of sorted) {
    const used = r.last_used_at ? safeParseIso(r.last_used_at) : null;
    if (!used || used < cutoff) return r;
  }
  return null;
}

function safeParseIso(s: string): Date | null {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isoToDate(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return new Date(NaN);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const mo = d.getMonth() + 1;
  const da = d.getDate();
  return `${y}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`;
}

function weekday0FromIso(iso: string): number {
  const d = isoToDate(iso);
  return Number.isNaN(d.getTime()) ? 0 : d.getDay();
}

function truncateName(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1)).trimEnd()}\u2026`;
}

function staleSinceLabel(
  lastUsed: string | null,
  createdAt: string | undefined,
  todayIso: string
): string {
  const ref = lastUsed ?? createdAt;
  if (!ref) return '';
  const used = safeParseIso(ref);
  const today = isoToDate(todayIso);
  if (!used || Number.isNaN(today.getTime())) return '';
  const days = Math.floor((today.getTime() - used.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 14) return '';
  if (days < 30) return `last cooked ${days} days ago`;
  if (days < 60) return 'last cooked over a month ago';
  if (days < 365) return `last cooked ${Math.max(1, Math.floor(days / 30))} months ago`;
  return 'last cooked over a year ago';
}

/** Helper for the orchestrator: returns local YYYY-MM-DD for `now`. */
export function todayIsoLocal(now: Date = new Date()): string {
  return toIsoDate(now);
}
