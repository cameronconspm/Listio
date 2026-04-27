/** Parse "HH:mm" to minutes from midnight. */
export function parseHmToMinutes(hm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

export function minutesToHm(total: number): string {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Monday date `YYYY-MM-DD` (local) — used for weekly engagement caps. */
export function getWeekBucketKey(d: Date = new Date()): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  const y = x.getFullYear();
  const mo = x.getMonth() + 1;
  const dayM = x.getDate();
  return `${y}-${String(mo).padStart(2, '0')}-${String(dayM).padStart(2, '0')}`;
}

export type QuietWindow = { enabled: boolean; start: string; end: string };

/**
 * Returns true if local clock time (hour, minute) falls inside quiet hours.
 * Supports windows that do not cross midnight (start < end) and those that do (e.g. 22:00–07:00).
 */
export function isTimeInQuietHours(
  hour: number,
  minute: number,
  quiet: QuietWindow | undefined
): boolean {
  if (!quiet?.enabled) return false;
  const start = parseHmToMinutes(quiet.start);
  const end = parseHmToMinutes(quiet.end);
  if (start === null || end === null) return false;
  const t = hour * 60 + minute;
  if (start === end) return false;
  if (start < end) {
    return t >= start && t < end;
  }
  // Crosses midnight
  return t >= start || t < end;
}

/**
 * If (hour, minute) is inside quiet hours, shift to the first minute after quiet ends (same day if possible).
 */
export function adjustHourMinuteOutOfQuietHours(
  hour: number,
  minute: number,
  quiet: QuietWindow | undefined
): { hour: number; minute: number } {
  if (!quiet?.enabled || !isTimeInQuietHours(hour, minute, quiet)) {
    return { hour, minute };
  }
  const end = parseHmToMinutes(quiet.end);
  if (end === null) return { hour, minute };
  const h = Math.floor(end / 60) % 24;
  const m = end % 60;
  return { hour: h, minute: m };
}

export type ShoppingTimeBucket = 'morning' | 'midday' | 'evening';

/** Typical hour for a store trip center (local) — reminder is offset from this. */
export function mapShoppingTimeBucketToTripHour(bucket: ShoppingTimeBucket): number {
  switch (bucket) {
    case 'morning':
      return 9;
    case 'midday':
      return 13;
    case 'evening':
      return 18;
    default:
      return 18;
  }
}

/** Subtract whole hours from `hour` (0–23), clamped. */
export function subtractHoursClamped(hour: number, deltaHours: number): number {
  return Math.max(0, Math.min(23, hour - deltaHours));
}

/**
 * Weekday for "prep your list" — three days before primary shopping day.
 * 0 = Sunday … 6 = Saturday.
 */
export function computePrepWeekday0(primaryShopDay0: number): number {
  const p = Math.max(0, Math.min(6, Math.floor(primaryShopDay0)));
  return (p - 3 + 7) % 7;
}

/** Smallest selected weekday — drives prep notification. */
export function primaryShoppingWeekday0(weekdaysSorted: number[]): number | null {
  if (weekdaysSorted.length === 0) return null;
  return Math.min(...weekdaysSorted);
}
