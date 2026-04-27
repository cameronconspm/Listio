import {
  adjustHourMinuteOutOfQuietHours,
  computePrepWeekday0,
  getWeekBucketKey,
  isTimeInQuietHours,
  mapShoppingTimeBucketToTripHour,
  parseHmToMinutes,
  primaryShoppingWeekday0,
  subtractHoursClamped,
} from '../src/services/notificationTimeUtils';
import {
  normalizeShoppingWeekdays,
  shouldUsePersonalizedShoppingSchedule,
  mergeNotificationDefaults,
} from '../src/services/notificationSchedulingDefaults';

describe('notificationTimeUtils', () => {
  it('parseHmToMinutes parses valid times', () => {
    expect(parseHmToMinutes('09:30')).toBe(9 * 60 + 30);
    expect(parseHmToMinutes('00:00')).toBe(0);
    expect(parseHmToMinutes('23:59')).toBe(23 * 60 + 59);
  });

  it('isTimeInQuietHours handles same-day window', () => {
    const q = { enabled: true, start: '22:00', end: '23:00' };
    expect(isTimeInQuietHours(21, 30, q)).toBe(false);
    expect(isTimeInQuietHours(22, 30, q)).toBe(true);
    expect(isTimeInQuietHours(23, 0, q)).toBe(false);
  });

  it('isTimeInQuietHours handles overnight window', () => {
    const q = { enabled: true, start: '22:00', end: '07:00' };
    expect(isTimeInQuietHours(23, 0, q)).toBe(true);
    expect(isTimeInQuietHours(3, 0, q)).toBe(true);
    expect(isTimeInQuietHours(12, 0, q)).toBe(false);
  });

  it('adjustHourMinuteOutOfQuietHours moves into allowed window', () => {
    const q = { enabled: true, start: '22:00', end: '07:00' };
    expect(adjustHourMinuteOutOfQuietHours(23, 0, q)).toEqual({ hour: 7, minute: 0 });
    expect(adjustHourMinuteOutOfQuietHours(12, 0, q)).toEqual({ hour: 12, minute: 0 });
  });

  it('getWeekBucketKey returns Monday date string', () => {
    const d = new Date(2026, 3, 2);
    const key = getWeekBucketKey(d);
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('mapShoppingTimeBucketToTripHour maps buckets', () => {
    expect(mapShoppingTimeBucketToTripHour('morning')).toBe(9);
    expect(mapShoppingTimeBucketToTripHour('midday')).toBe(13);
    expect(mapShoppingTimeBucketToTripHour('evening')).toBe(18);
  });

  it('subtractHoursClamped clamps to 0–23', () => {
    expect(subtractHoursClamped(9, 1)).toBe(8);
    expect(subtractHoursClamped(0, 1)).toBe(0);
    expect(subtractHoursClamped(23, 1)).toBe(22);
  });

  it('computePrepWeekday0 is three days before primary (Sun=0)', () => {
    expect(computePrepWeekday0(2)).toBe(6);
    expect(computePrepWeekday0(3)).toBe(0);
    expect(computePrepWeekday0(6)).toBe(3);
  });

  it('primaryShoppingWeekday0 returns minimum weekday', () => {
    expect(primaryShoppingWeekday0([3, 1, 5])).toBe(1);
    expect(primaryShoppingWeekday0([6])).toBe(6);
  });

  it('normalizeShoppingWeekdays sorts unique valid days', () => {
    expect(normalizeShoppingWeekdays([5, 1, 1, 99, -1])).toEqual([1, 5]);
    expect(normalizeShoppingWeekdays(undefined)).toEqual([]);
  });

  it('shouldUsePersonalizedShoppingSchedule respects flag and weekdays', () => {
    const off = mergeNotificationDefaults({
      mealReminders: true,
      shoppingReminders: true,
      weeklyPlanningReminders: false,
      householdActivity: false,
      sharedUpdates: false,
      productAnnouncements: false,
      notificationStyle: 'push',
      shoppingWeekdays: [2, 6],
      usePersonalizedShoppingReminders: false,
    });
    expect(shouldUsePersonalizedShoppingSchedule(off)).toBe(false);

    const on = mergeNotificationDefaults({
      mealReminders: true,
      shoppingReminders: true,
      weeklyPlanningReminders: false,
      householdActivity: false,
      sharedUpdates: false,
      productAnnouncements: false,
      notificationStyle: 'push',
      shoppingWeekdays: [2, 6],
      usePersonalizedShoppingReminders: true,
    });
    expect(shouldUsePersonalizedShoppingSchedule(on)).toBe(true);
  });
});
