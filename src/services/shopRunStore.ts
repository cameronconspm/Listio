/**
 * Tracks shop run history for gamification: all-time run count and weekly streak.
 *
 * Streak logic:
 *  - A "streak week" = a calendar week (Mon–Sun) that contains ≥1 completed run.
 *  - Same week as last run   → no change to streak (idempotent).
 *  - Previous week           → streak + 1.
 *  - Two or more weeks ago   → streak resets to 1.
 *  - Very first run          → streak = 1, runCount = 1.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@listio/shop_runs_v1';

export type ShopRunState = {
  /** All-time number of completed shop runs. */
  runCount: number;
  /** Consecutive weeks with ≥1 shop run completed. */
  streakWeeks: number;
  /** ISO string of the last completed run (Date.toISOString()). */
  lastRunAt: string | null;
  /**
   * Monday ISO date of the calendar week that last incremented the streak
   * (YYYY-MM-DD, always a Monday). Used to detect same-week vs new-week.
   */
  lastStreakWeekMonday: string | null;
};

const DEFAULT_STATE: ShopRunState = {
  runCount: 0,
  streakWeeks: 0,
  lastRunAt: null,
  lastStreakWeekMonday: null,
};

/** Returns the Monday (YYYY-MM-DD) of the ISO week that contains `date`. */
function getMondayOf(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift so Mon=0
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

async function read(): Promise<ShopRunState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const p = JSON.parse(raw) as Partial<ShopRunState>;
    return {
      runCount: typeof p.runCount === 'number' ? Math.max(0, p.runCount) : 0,
      streakWeeks: typeof p.streakWeeks === 'number' ? Math.max(0, p.streakWeeks) : 0,
      lastRunAt: typeof p.lastRunAt === 'string' ? p.lastRunAt : null,
      lastStreakWeekMonday:
        typeof p.lastStreakWeekMonday === 'string' ? p.lastStreakWeekMonday : null,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

async function write(next: ShopRunState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage failures are non-fatal for gamification data.
  }
}

/**
 * Records a completed shop run and returns the updated state.
 * Pass `now` only in tests (defaults to current time).
 */
export async function recordShopRun(now?: Date): Promise<ShopRunState> {
  const prev = await read();
  const ts = now ?? new Date();
  const thisWeekMonday = getMondayOf(ts);
  const nowIso = ts.toISOString();

  let newStreak = prev.streakWeeks;

  if (!prev.lastStreakWeekMonday) {
    // Very first run ever.
    newStreak = 1;
  } else if (prev.lastStreakWeekMonday === thisWeekMonday) {
    // Another run in the same week — streak doesn't change.
    newStreak = Math.max(1, prev.streakWeeks);
  } else {
    // Different week — check if it's consecutive.
    const prevMonday = new Date(prev.lastStreakWeekMonday + 'T00:00:00Z');
    const nextWeekMonday = new Date(prevMonday);
    nextWeekMonday.setUTCDate(prevMonday.getUTCDate() + 7);
    const nextWeekStr = nextWeekMonday.toISOString().slice(0, 10);

    if (thisWeekMonday === nextWeekStr) {
      // Consecutive week → increment streak.
      newStreak = prev.streakWeeks + 1;
    } else {
      // Gap of ≥2 weeks → reset.
      newStreak = 1;
    }
  }

  const next: ShopRunState = {
    runCount: prev.runCount + 1,
    streakWeeks: newStreak,
    lastRunAt: nowIso,
    lastStreakWeekMonday: thisWeekMonday,
  };

  await write(next);
  return next;
}

export async function getShopRunState(): Promise<ShopRunState> {
  return read();
}

/** For tests / QA settings only. */
export async function resetShopRunState(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
