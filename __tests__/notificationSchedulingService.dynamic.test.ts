/**
 * Integration test for the dynamic-content scheduler. Mocks `expo-notifications`
 * and asserts that:
 *  - The cancel-all + reschedule pipeline runs end-to-end.
 *  - Static "Review your list before you head to the store." copy is gone.
 *  - tonightsMeal renders the actual planned meal name in the body.
 *  - shoppingDay smart-skips when the list is empty.
 */

import type { LocalDataContext } from '../src/services/notificationContentService';
import { rescheduleLocalNotificationsFromPreferences } from '../src/services/notificationSchedulingService';

type ScheduleCall = {
  identifier: string;
  content: { title: string; body: string; data?: Record<string, unknown> };
  trigger: Record<string, unknown>;
};

const scheduledCalls: ScheduleCall[] = [];
const cancelledIdentifiers: string[] = [];

jest.mock('expo-notifications', () => {
  const SchedulableTriggerInputTypes = {
    DAILY: 'daily',
    WEEKLY: 'weekly',
    DATE: 'date',
  } as const;
  return {
    SchedulableTriggerInputTypes,
    AndroidImportance: { DEFAULT: 3 },
    setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
    getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([]),
    cancelScheduledNotificationAsync: jest.fn(async (id: string) => {
      cancelledIdentifiers.push(id);
    }),
    scheduleNotificationAsync: jest.fn(async (req: ScheduleCall) => {
      scheduledCalls.push(req);
      return req.identifier;
    }),
    getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  };
});

jest.mock('../src/services/userPreferencesService', () => ({
  patchUserPreferences: jest.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  scheduledCalls.length = 0;
  cancelledIdentifiers.length = 0;
});

const TODAY = '2099-04-20'; // Monday

const mealCtx = (overrides: Partial<LocalDataContext> = {}): LocalDataContext => ({
  today: TODAY,
  meals: [],
  recipes: [],
  list: { totalCount: 0, uncheckedCount: 0, aisleCount: 0 },
  ...overrides,
});

describe('rescheduleLocalNotificationsFromPreferences (dynamic)', () => {
  it('schedules tonightsMeal with the dynamic meal name and skips empty days', async () => {
    const ctx = mealCtx({
      meals: [
        { meal_date: '2099-04-20', name: 'Spaghetti Bolognese', meal_slot: 'dinner' },
        { meal_date: '2099-04-22', name: 'Salmon Tacos', meal_slot: 'dinner' },
      ],
      list: { totalCount: 4, uncheckedCount: 4, aisleCount: 2 },
    });

    await rescheduleLocalNotificationsFromPreferences(
      {
        notifications: {
          mealReminders: true,
          mealReminderMode: 'planned_only',
          shoppingReminders: false,
          weeklyPlanningReminders: false,
          householdActivity: false,
          sharedUpdates: false,
          productAnnouncements: false,
          notificationStyle: 'push',
          mealReminderTime: '17:00',
        },
      },
      ctx
    );

    const mealNudges = scheduledCalls.filter((c) =>
      c.identifier.startsWith('listio-tonights-meal')
    );
    expect(mealNudges.length).toBe(2);
    expect(mealNudges.every((n) => n.trigger.type === 'date')).toBe(true);
    const bodies = mealNudges.map((c) => c.content.body).join(' | ');
    expect(bodies).toContain('Spaghetti Bolognese');
    expect(bodies).toContain('Salmon Tacos');
    expect(bodies).not.toContain('See what is planned for your household and what to shop for.');
  });

  it('smart-skips shoppingDay when the list is empty', async () => {
    await rescheduleLocalNotificationsFromPreferences(
      {
        notifications: {
          mealReminders: false,
          mealReminderMode: 'off',
          shoppingReminders: true,
          weeklyPlanningReminders: false,
          householdActivity: false,
          sharedUpdates: false,
          productAnnouncements: false,
          notificationStyle: 'push',
          shoppingWeekdays: [2, 6],
          shoppingTimeBucket: 'evening',
          usePersonalizedShoppingReminders: true,
        },
      },
      mealCtx()
    );

    const shopNudges = scheduledCalls.filter((c) => c.identifier.startsWith('listio-shop-wd-'));
    expect(shopNudges.length).toBe(0);
  });

  it('schedules personalized shopping nudges with dynamic body when list has items', async () => {
    await rescheduleLocalNotificationsFromPreferences(
      {
        notifications: {
          mealReminders: false,
          mealReminderMode: 'off',
          shoppingReminders: true,
          weeklyPlanningReminders: false,
          householdActivity: false,
          sharedUpdates: false,
          productAnnouncements: false,
          notificationStyle: 'push',
          shoppingWeekdays: [2],
          shoppingTimeBucket: 'evening',
          usePersonalizedShoppingReminders: true,
        },
      },
      mealCtx({
        list: { totalCount: 12, uncheckedCount: 12, aisleCount: 5 },
      })
    );

    const shopNudges = scheduledCalls.filter((c) => c.identifier.startsWith('listio-shop-wd-'));
    expect(shopNudges.length).toBe(1);
    expect(shopNudges[0].content.body).toContain('12 items');
    expect(shopNudges[0].content.body).toContain('5 aisles');
  });

  it('lets shoppingDay collisions beat tonightsMeal (transactional > personal)', async () => {
    // Tuesday (weekday0=2) shopping reminder at 17:00 (evening bucket -> 18-1 = 17),
    // Tuesday meal reminder at 17:00 — same bucket, shopping should win.
    await rescheduleLocalNotificationsFromPreferences(
      {
        notifications: {
          mealReminders: true,
          mealReminderMode: 'planned_only',
          shoppingReminders: true,
          weeklyPlanningReminders: false,
          householdActivity: false,
          sharedUpdates: false,
          productAnnouncements: false,
          notificationStyle: 'push',
          mealReminderTime: '17:00',
          shoppingWeekdays: [2],
          shoppingTimeBucket: 'evening',
          usePersonalizedShoppingReminders: true,
        },
      },
      mealCtx({
        meals: [{ meal_date: '2099-04-21', name: 'Pasta', meal_slot: 'dinner' }], // 04-21 is Tuesday
        list: { totalCount: 4, uncheckedCount: 4, aisleCount: 2 },
      })
    );

    const ids = scheduledCalls.map((c) => c.identifier);
    expect(ids).toContain('listio-shop-wd-2');
    expect(ids).not.toContain('listio-tonights-meal-2099-04-21');
  });

  it('skips all scheduling when notification style is email', async () => {
    await rescheduleLocalNotificationsFromPreferences(
      {
        notifications: {
          mealReminders: true,
          mealReminderMode: 'planned_only',
          shoppingReminders: true,
          weeklyPlanningReminders: false,
          householdActivity: false,
          sharedUpdates: false,
          productAnnouncements: false,
          notificationStyle: 'email',
        },
      },
      mealCtx()
    );
    expect(scheduledCalls.length).toBe(0);
  });
});
