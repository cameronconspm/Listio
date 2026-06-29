import {
  clampSelectedDateToWindow,
  getScheduleDates,
  normalizeMealScheduleConfigForToday,
  scheduleWindowIncludesDate,
  shiftScheduleStartToIncludeDate,
  toDateString,
} from '../src/utils/dateUtils';

describe('meal schedule window', () => {
  it('scheduleWindowIncludesDate detects in-range days', () => {
    expect(scheduleWindowIncludesDate('2026-05-11', 7, '2026-05-14')).toBe(true);
    expect(scheduleWindowIncludesDate('2026-05-11', 7, '2026-05-18')).toBe(false);
  });

  it('shiftScheduleStartToIncludeDate moves window forward for future dates', () => {
    expect(shiftScheduleStartToIncludeDate('2026-05-11', 7, '2026-05-20')).toBe('2026-05-14');
    expect(scheduleWindowIncludesDate('2026-05-14', 7, '2026-05-20')).toBe(true);
  });

  it('shiftScheduleStartToIncludeDate moves window backward for past dates', () => {
    expect(shiftScheduleStartToIncludeDate('2026-05-11', 7, '2026-05-05')).toBe('2026-05-05');
  });

  it('normalizeMealScheduleConfigForToday shifts stale persisted windows', () => {
    const today = toDateString(new Date());
    const stale = { startDate: '2020-01-01', length: 7 as const };
    const normalized = normalizeMealScheduleConfigForToday(stale);
    expect(scheduleWindowIncludesDate(normalized.startDate, normalized.length, today)).toBe(true);
  });

  it('clampSelectedDateToWindow prefers today when selection is outside range', () => {
    const visible = getScheduleDates('2026-05-11', 7);
    const today = toDateString(new Date());
    const visibleHasToday = visible.some((d) => toDateString(d) === today);
    if (visibleHasToday) {
      expect(clampSelectedDateToWindow('2099-01-01', visible)).toBe(today);
    } else {
      expect(clampSelectedDateToWindow('2099-01-01', visible)).toBe(toDateString(visible[0]));
    }
  });
});
