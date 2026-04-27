/** Format date as "YYYY-MM-DD" */
export function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parse YYYY-MM-DD as a stable local date (midday avoids DST edge cases). */
export function parseYmdLocal(ymd: string): Date {
  return new Date(`${ymd}T12:00:00`);
}

/** Next local midnight as ISO string (start of tomorrow); used for "don't ask today" snooze. */
export function nextLocalMidnightIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Get Monday of the week containing the given date (week starts Monday) */
export function getWeekStart(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday = 1, Sunday = 0
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Get array of 7 dates (Mon–Sun) for the week containing the given date */
export function getWeekDates(anchor: Date): Date[] {
  const start = getWeekStart(anchor);
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d);
  }
  return dates;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Format as "Monday, Mar 24" */
export function formatDayLabel(d: Date): string {
  const day = DAY_NAMES[d.getDay()];
  const month = MONTH_NAMES[d.getMonth()];
  const date = d.getDate();
  return `${day}, ${month} ${date}`;
}

/** Format as "Mon" for week strip */
export function formatDayShort(d: Date): string {
  return DAY_NAMES[d.getDay()].slice(0, 3);
}

/** Format as "Mon 24" for compact week strip */
export function formatDayShortWithDate(d: Date): string {
  return `${DAY_NAMES[d.getDay()].slice(0, 3)} ${d.getDate()}`;
}

/** Format as "Mar 16–22" for week range label */
export function formatWeekRange(start: Date, end: Date): string {
  const m1 = MONTH_NAMES[start.getMonth()];
  const m2 = MONTH_NAMES[end.getMonth()];
  const d1 = start.getDate();
  const d2 = end.getDate();
  if (m1 === m2) return `${m1} ${d1}–${d2}`;
  return `${m1} ${d1} – ${m2} ${d2}`;
}

/** Get array of dates for a schedule window: startDate + length days */
export function getScheduleDates(startDate: string, length: number): Date[] {
  const start = parseYmdLocal(startDate);
  const dates: Date[] = [];
  for (let i = 0; i < length; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d);
  }
  return dates;
}

/** Format schedule label: "Mar 16–22 · 7 days" or "Thu 20 – Sun 23 · 4 days" */
export function formatScheduleLabel(start: Date, end: Date, length: number): string {
  const range = formatWeekRange(start, end);
  return `${range} · ${length} day${length !== 1 ? 's' : ''}`;
}

/** Format schedule preview: "Mon 23 → Sun 29" */
export function formatSchedulePreview(start: Date, end: Date): string {
  const s = `${formatDayShort(start)} ${start.getDate()}`;
  const e = `${formatDayShort(end)} ${end.getDate()}`;
  return `${s} → ${e}`;
}

/** Shift startDate by delta days (negative = backward, positive = forward). Returns new YYYY-MM-DD. */
export function shiftScheduleWindow(startDate: string, delta: number): string {
  const d = parseYmdLocal(startDate);
  d.setDate(d.getDate() + delta);
  return toDateString(d);
}

/** Weekday index Mon=0 … Sun=6 (matches week strip order). */
export function getWeekdayIndexMonSun(d: Date): number {
  const js = d.getDay();
  return js === 0 ? 6 : js - 1;
}

/** Single weekday selected: the weekday of the given YYYY-MM-DD. */
export function defaultWeekdaySelectionFromDate(ymd: string): boolean[] {
  const idx = getWeekdayIndexMonSun(parseYmdLocal(ymd));
  const w = [false, false, false, false, false, false, false];
  w[idx] = true;
  return w;
}

/** Map Mon=0…Sun=6 to JS Date.getDay() (Sun=0 … Sat=6). */
export function monSunIndexToJsDay(idx: number): number {
  if (idx < 0 || idx > 6) return 1;
  return idx === 6 ? 0 : idx + 1;
}

/** Next calendar date on or after `from` (local midnight) that falls on `targetJsDay`. */
export function nextOccurrenceOfWeekday(from: Date, targetJsDay: number): Date {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const diff = (targetJsDay - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

export type WeekdayScheduleArgs = {
  /** Anchor for “next” weekday (typically today, local). */
  fromDate: Date;
  /** Length 7, Mon–Sun; true = include that weekday. */
  selectedWeekdays: boolean[];
  /** If true, repeat each selected weekday for `recurringWeeks` weeks. */
  recurring: boolean;
  /** Number of weeks to repeat (1–12) when `recurring` is true. */
  recurringWeeks: number;
  /** Skip these YYYY-MM-DD (e.g. source meal when copying). */
  excludeDates?: string[];
};

/**
 * Resolves selected weekdays into concrete dates from `fromDate`, synced to the calendar.
 * Non-recurring: one occurrence per selected weekday (next on/after `fromDate`).
 * Recurring: that weekday every week for `recurringWeeks` weeks.
 */
export function expandMealDatesFromWeekdaySchedule(args: WeekdayScheduleArgs): string[] {
  const { fromDate, selectedWeekdays, recurring, recurringWeeks, excludeDates = [] } = args;
  const exclude = new Set(excludeDates);
  const from = new Date(fromDate);
  from.setHours(0, 0, 0, 0);

  const weeks = recurring ? Math.max(1, Math.min(12, recurringWeeks)) : 1;

  const results: string[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < 7; i++) {
    if (!selectedWeekdays[i]) continue;
    const targetJsDay = monSunIndexToJsDay(i);
    let first = new Date(nextOccurrenceOfWeekday(from, targetJsDay));
    while (exclude.has(toDateString(first))) {
      first.setDate(first.getDate() + 7);
    }
    const base = new Date(first.getTime());
    for (let w = 0; w < weeks; w++) {
      const d = new Date(base);
      d.setDate(base.getDate() + w * 7);
      const s = toDateString(d);
      if (exclude.has(s)) continue;
      if (!seen.has(s)) {
        seen.add(s);
        results.push(s);
      }
    }
  }

  return results.sort();
}

/** Get consecutive date strings (YYYY-MM-DD) starting from startDate for `count` days. */
export function getConsecutiveDateStrings(startDate: string, count: number): string[] {
  const start = parseYmdLocal(startDate);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(toDateString(d));
  }
  return out;
}

/** Clamp selectedDate to visibleDates. Returns first visible date if selectedDate is outside. */
export function clampSelectedDateToWindow(
  selectedDate: string,
  visibleDates: Date[]
): string {
  const selectedInRange = visibleDates.some((d) => toDateString(d) === selectedDate);
  if (selectedInRange || visibleDates.length === 0) return selectedDate;
  return toDateString(visibleDates[0]);
}
