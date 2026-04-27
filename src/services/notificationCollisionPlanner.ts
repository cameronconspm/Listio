/**
 * Pure scheduling planner — takes candidate notifications and returns the
 * subset that survive collision + per-day cap rules. Has no React Native or
 * Expo dependencies so it can be unit-tested in isolation.
 */

export type NotificationKind =
  | 'mealDaily'
  | 'tonightsMeal'
  | 'weeklyPreview'
  | 'recipeSpotlight'
  | 'shoppingDay'
  | 'prepBeforeShop'
  | 'weeklyPlanning';

/**
 * Higher number wins collisions. Transactional shopping nudges always beat
 * engagement nudges so a user about to leave for the store never has their
 * trip reminder drowned by a meal preview.
 */
const PRIORITY: Record<NotificationKind, number> = {
  shoppingDay: 100,
  prepBeforeShop: 90,
  tonightsMeal: 80,
  mealDaily: 70,
  weeklyPreview: 60,
  recipeSpotlight: 50,
  weeklyPlanning: 40,
};

const TRANSACTIONAL_KINDS: ReadonlySet<NotificationKind> = new Set([
  'shoppingDay',
  'prepBeforeShop',
]);

/**
 * Tonight's-meal and the legacy daily meal reminder are personal/expected
 * (the user explicitly chose them) so they don't count against the per-week
 * engagement budget. Pure marketing-style nudges do.
 */
const ENGAGEMENT_KINDS: ReadonlySet<NotificationKind> = new Set([
  'weeklyPreview',
  'recipeSpotlight',
  'weeklyPlanning',
]);

export type WhenSpec =
  | { type: 'daily'; hour: number; minute: number }
  | { type: 'weekly'; weekday0: number; hour: number; minute: number }
  | { type: 'oneShot'; date: Date };

export type PlannedNotification = {
  identifier: string;
  kind: NotificationKind;
  when: WhenSpec;
};

/**
 * 30-min buckets keep "near each other" collisions from slipping through.
 * Two pings 10 minutes apart still feel like one cluster from the user's POV.
 */
const HOUR_BUCKET_MINUTES = 30;
/** Hard cap on engagement nudges (weeklyPreview / recipeSpotlight / weeklyPlanning) per ISO week. */
export const MAX_ENGAGEMENT_PER_WEEK = 3;

function bucketKey(weekday0: number, hour: number, minute: number): string {
  const total = hour * 60 + minute;
  const bucket = Math.floor(total / HOUR_BUCKET_MINUTES);
  return `${weekday0}:${bucket}`;
}

type Slot = { weekday0: number; hour: number; minute: number };

/** Expand a candidate's `when` into the weekday slots it occupies in a typical week. */
function expandSlots(when: WhenSpec): Slot[] {
  if (when.type === 'daily') {
    return Array.from({ length: 7 }, (_, w) => ({
      weekday0: w,
      hour: when.hour,
      minute: when.minute,
    }));
  }
  if (when.type === 'weekly') {
    return [{ weekday0: when.weekday0, hour: when.hour, minute: when.minute }];
  }
  // oneShot — Sunday=0
  return [{ weekday0: when.date.getDay(), hour: when.date.getHours(), minute: when.date.getMinutes() }];
}

/**
 * Resolve collisions and per-day caps:
 * - Higher-priority candidates reserve their (weekday, 30-min bucket) slots first.
 * - Each weekday allows at most 1 transactional + 1 personal/engagement notification.
 * - Engagement-kind candidates also share a per-week ceiling.
 *
 * Returns survivors in original order. Daily candidates that lose any slot
 * are dropped wholesale (callers can pre-explode them into per-weekday
 * weekly entries if they want partial survival).
 */
export function planNotifications(candidates: PlannedNotification[]): PlannedNotification[] {
  const ordered = [...candidates].sort((a, b) => PRIORITY[b.kind] - PRIORITY[a.kind]);

  const usedBuckets = new Set<string>();
  type DayCounts = { transactional: number; personal: number };
  const dayCounts = new Map<number, DayCounts>();
  let engagementUsed = 0;
  const surviving = new Set<string>();

  for (const cand of ordered) {
    const isTrans = TRANSACTIONAL_KINDS.has(cand.kind);
    const isEngagement = ENGAGEMENT_KINDS.has(cand.kind);

    if (isEngagement && engagementUsed >= MAX_ENGAGEMENT_PER_WEEK) continue;

    const slots = expandSlots(cand.when);
    let blocked = false;
    for (const slot of slots) {
      const counts = dayCounts.get(slot.weekday0) ?? { transactional: 0, personal: 0 };
      const overCap = isTrans ? counts.transactional >= 1 : counts.personal >= 1;
      if (overCap) {
        blocked = true;
        break;
      }
      if (usedBuckets.has(bucketKey(slot.weekday0, slot.hour, slot.minute))) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    for (const slot of slots) {
      const counts = dayCounts.get(slot.weekday0) ?? { transactional: 0, personal: 0 };
      if (isTrans) counts.transactional += 1;
      else counts.personal += 1;
      dayCounts.set(slot.weekday0, counts);
      usedBuckets.add(bucketKey(slot.weekday0, slot.hour, slot.minute));
    }
    if (isEngagement) engagementUsed += 1;
    surviving.add(cand.identifier);
  }

  return candidates.filter((c) => surviving.has(c.identifier));
}

/**
 * Helper for callers that don't want a daily candidate dropped wholesale on
 * a single collision. Splits one daily into 7 weekly equivalents so the
 * planner can keep the un-collided days.
 */
export function explodeDailyToWeekly(
  base: PlannedNotification & { when: Extract<WhenSpec, { type: 'daily' }> }
): PlannedNotification[] {
  const { hour, minute } = base.when;
  return Array.from({ length: 7 }, (_, w) => ({
    identifier: `${base.identifier}-wd-${w}`,
    kind: base.kind,
    when: { type: 'weekly' as const, weekday0: w, hour, minute },
  }));
}
