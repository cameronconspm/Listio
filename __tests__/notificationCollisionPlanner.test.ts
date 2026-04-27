import {
  explodeDailyToWeekly,
  MAX_ENGAGEMENT_PER_WEEK,
  planNotifications,
  type PlannedNotification,
} from '../src/services/notificationCollisionPlanner';

const weekly = (
  identifier: string,
  kind: PlannedNotification['kind'],
  weekday0: number,
  hour: number,
  minute: number
): PlannedNotification => ({
  identifier,
  kind,
  when: { type: 'weekly', weekday0, hour, minute },
});

describe('notificationCollisionPlanner', () => {
  it('keeps both candidates when they land on different days', () => {
    const a = weekly('a', 'shoppingDay', 1, 18, 0);
    const b = weekly('b', 'tonightsMeal', 2, 17, 0);
    const survivors = planNotifications([a, b]);
    expect(survivors.map((s) => s.identifier).sort()).toEqual(['a', 'b']);
  });

  it('drops the lower-priority candidate when buckets collide', () => {
    // Both target Monday 17:00 — same 30-min bucket. shoppingDay (transactional) wins.
    const meal = weekly('meal', 'tonightsMeal', 1, 17, 0);
    const shop = weekly('shop', 'shoppingDay', 1, 17, 10);
    const survivors = planNotifications([meal, shop]);
    expect(survivors.map((s) => s.identifier)).toEqual(['shop']);
  });

  it('enforces 1 transactional + 1 personal per weekday', () => {
    const trans1 = weekly('trans1', 'shoppingDay', 3, 9, 0);
    const trans2 = weekly('trans2', 'shoppingDay', 3, 17, 0);
    const personal1 = weekly('personal1', 'tonightsMeal', 3, 18, 30);
    const personal2 = weekly('personal2', 'mealDaily', 3, 20, 0);
    const survivors = planNotifications([trans1, trans2, personal1, personal2]);
    expect(survivors.map((s) => s.identifier).sort()).toEqual(['personal1', 'trans1']);
  });

  it('caps engagement nudges per week regardless of weekday spread', () => {
    const fakeEngagement = (id: string, weekday0: number) =>
      weekly(id, 'recipeSpotlight', weekday0, 16, 0);
    const candidates: PlannedNotification[] = [
      fakeEngagement('e1', 0),
      fakeEngagement('e2', 1),
      fakeEngagement('e3', 2),
      fakeEngagement('e4', 3),
      fakeEngagement('e5', 4),
    ];
    const survivors = planNotifications(candidates);
    expect(survivors.length).toBe(MAX_ENGAGEMENT_PER_WEEK);
  });

  it('treats tonightsMeal as personal, not engagement (not capped per week)', () => {
    // 7 personal nudges across 7 distinct days — none are engagement-capped.
    const candidates = Array.from({ length: 7 }, (_, w) =>
      weekly(`tm-${w}`, 'tonightsMeal', w, 18, 0)
    );
    const survivors = planNotifications(candidates);
    expect(survivors.length).toBe(7);
  });

  it('expands daily candidates into 7 weekly entries via explodeDailyToWeekly', () => {
    const daily: PlannedNotification & { when: { type: 'daily'; hour: number; minute: number } } = {
      identifier: 'meal-daily',
      kind: 'mealDaily',
      when: { type: 'daily', hour: 18, minute: 0 },
    };
    const exploded = explodeDailyToWeekly(daily);
    expect(exploded.length).toBe(7);
    expect(exploded[0].identifier).toMatch(/wd-0$/);
    expect(exploded[6].identifier).toMatch(/wd-6$/);
  });

  it('partial-survives an exploded daily when a single weekday collides', () => {
    const exploded = explodeDailyToWeekly({
      identifier: 'meal-daily',
      kind: 'mealDaily',
      when: { type: 'daily', hour: 18, minute: 0 },
    });
    // Make Tuesday (weekday0=2) shoppingDay collide at 18:10.
    const collide = weekly('shop', 'shoppingDay', 2, 18, 10);
    const survivors = planNotifications([...exploded, collide]);
    const ids = survivors.map((s) => s.identifier);
    expect(ids).toContain('shop');
    expect(ids).not.toContain('meal-daily-wd-2');
    expect(ids).toContain('meal-daily-wd-0');
    expect(ids).toContain('meal-daily-wd-6');
    // 6 surviving meal nudges + 1 shopping = 7
    expect(survivors.length).toBe(7);
  });
});
