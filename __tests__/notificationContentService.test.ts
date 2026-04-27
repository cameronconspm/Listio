import {
  buildContent,
  pickPrimaryMealForDate,
  pickSpotlightRecipe,
  upcomingWeekMealsByDate,
  type LocalDataContext,
} from '../src/services/notificationContentService';

const TODAY = '2026-04-20'; // Monday

const baseCtx = (overrides: Partial<LocalDataContext> = {}): LocalDataContext => ({
  today: TODAY,
  meals: [],
  recipes: [],
  list: { totalCount: 0, uncheckedCount: 0, aisleCount: 0 },
  ...overrides,
});

describe('notificationContentService', () => {
  describe('pickPrimaryMealForDate', () => {
    it('prefers dinner over other slots on the same day', () => {
      const meal = pickPrimaryMealForDate(
        [
          { meal_date: '2026-04-20', name: 'Toast', meal_slot: 'breakfast' },
          { meal_date: '2026-04-20', name: 'Pasta', meal_slot: 'dinner' },
          { meal_date: '2026-04-20', name: 'Sandwich', meal_slot: 'lunch' },
        ],
        '2026-04-20'
      );
      expect(meal?.name).toBe('Pasta');
    });

    it('returns null when no meal scheduled that day', () => {
      const meal = pickPrimaryMealForDate(
        [{ meal_date: '2026-04-21', name: 'Pasta', meal_slot: 'dinner' }],
        '2026-04-20'
      );
      expect(meal).toBeNull();
    });
  });

  describe('upcomingWeekMealsByDate', () => {
    it('picks one meal per upcoming day in chronological order', () => {
      const ctx = baseCtx({
        meals: [
          { meal_date: '2026-04-22', name: 'Salmon', meal_slot: 'dinner' },
          { meal_date: '2026-04-20', name: 'Pasta', meal_slot: 'dinner' },
          { meal_date: '2026-04-22', name: 'Eggs', meal_slot: 'breakfast' },
        ],
      });
      const out = upcomingWeekMealsByDate(ctx);
      expect(out.map((m) => m.meal_date)).toEqual(['2026-04-20', '2026-04-22']);
      expect(out.map((m) => m.name)).toEqual(['Pasta', 'Salmon']);
    });
  });

  describe('buildContent: tonightsMeal', () => {
    it('returns null when the day has no meal (smart-skip)', () => {
      const ctx = baseCtx();
      const out = buildContent({ kind: 'tonightsMeal', date: '2026-04-20' }, ctx);
      expect(out).toBeNull();
    });

    it('renders a dynamic body with meal name + open list count', () => {
      const ctx = baseCtx({
        meals: [{ meal_date: '2026-04-20', name: 'Spaghetti Bolognese', meal_slot: 'dinner' }],
        list: { totalCount: 5, uncheckedCount: 4, aisleCount: 2 },
      });
      const out = buildContent({ kind: 'tonightsMeal', date: '2026-04-20' }, ctx);
      expect(out?.title).toBe('Tonight');
      expect(out?.body).toContain('Spaghetti Bolognese');
      expect(out?.body).toContain('4 items');
      expect(out?.data.navigateTo).toBe('meals');
    });
  });

  describe('buildContent: weeklyPreview', () => {
    it('returns null when no meals planned', () => {
      const out = buildContent({ kind: 'weeklyPreview' }, baseCtx());
      expect(out).toBeNull();
    });

    it('lists up to 3 meals with weekday prefixes', () => {
      const ctx = baseCtx({
        meals: [
          { meal_date: '2026-04-20', name: 'Pasta', meal_slot: 'dinner' },
          { meal_date: '2026-04-22', name: 'Salmon', meal_slot: 'dinner' },
          { meal_date: '2026-04-24', name: 'Tacos', meal_slot: 'dinner' },
          { meal_date: '2026-04-26', name: 'Pizza', meal_slot: 'dinner' },
        ],
      });
      const out = buildContent({ kind: 'weeklyPreview' }, ctx);
      expect(out?.body).toContain('Mon Pasta');
      expect(out?.body).toContain('Wed Salmon');
      expect(out?.body).toContain('Fri Tacos');
      expect(out?.body).toContain('+1 more');
    });
  });

  describe('buildContent: recipeSpotlight', () => {
    it('returns null when fewer than 3 recipes', () => {
      const ctx = baseCtx({
        recipes: [
          { id: 'a', name: 'Curry', last_used_at: null },
          { id: 'b', name: 'Stew', last_used_at: null },
        ],
      });
      const out = buildContent({ kind: 'recipeSpotlight' }, ctx);
      expect(out).toBeNull();
    });

    it('returns null when every recipe was used in the last 14 days', () => {
      const recent = new Date(TODAY);
      recent.setDate(recent.getDate() - 1);
      const isoRecent = recent.toISOString();
      const ctx = baseCtx({
        recipes: [
          { id: 'a', name: 'Curry', last_used_at: isoRecent },
          { id: 'b', name: 'Stew', last_used_at: isoRecent },
          { id: 'c', name: 'Soup', last_used_at: isoRecent },
        ],
      });
      const out = buildContent({ kind: 'recipeSpotlight' }, ctx);
      expect(out).toBeNull();
    });

    it('picks the stalest recipe and includes its name', () => {
      const old = new Date(TODAY);
      old.setDate(old.getDate() - 60);
      const ctx = baseCtx({
        recipes: [
          { id: 'fresh', name: 'Curry', last_used_at: new Date(TODAY).toISOString() },
          { id: 'stale', name: 'Thai Basil Chicken', last_used_at: old.toISOString() },
          { id: 'never', name: 'Lasagna', last_used_at: null, created_at: '2025-01-01' },
        ],
      });
      const out = buildContent({ kind: 'recipeSpotlight' }, ctx);
      expect(out?.body).toMatch(/Lasagna|Thai Basil Chicken/);
      expect(out?.data.navigateTo).toBe('recipes');
    });
  });

  describe('pickSpotlightRecipe', () => {
    it('prefers a never-cooked recipe over a stale one', () => {
      const old = new Date(TODAY);
      old.setDate(old.getDate() - 60);
      const ctx = baseCtx({
        recipes: [
          { id: 'stale', name: 'Stew', last_used_at: old.toISOString() },
          { id: 'never', name: 'Curry', last_used_at: null, created_at: '2025-06-01' },
          { id: 'recent', name: 'Eggs', last_used_at: new Date(TODAY).toISOString() },
        ],
      });
      const pick = pickSpotlightRecipe(ctx);
      expect(pick?.id).toBe('never');
    });
  });

  describe('buildContent: shoppingDay', () => {
    it('smart-skips on an empty list', () => {
      const out = buildContent({ kind: 'shoppingDay' }, baseCtx());
      expect(out).toBeNull();
    });

    it('renders item + aisle counts', () => {
      const ctx = baseCtx({
        list: { totalCount: 12, uncheckedCount: 12, aisleCount: 5 },
      });
      const out = buildContent({ kind: 'shoppingDay' }, ctx);
      expect(out?.body).toContain('12 items');
      expect(out?.body).toContain('5 aisles');
      expect(out?.data.navigateTo).toBe('list');
    });
  });

  describe('buildContent: prepBeforeShop', () => {
    it('uses the first shopping weekday name in the body', () => {
      const ctx = baseCtx({
        shoppingWeekdays: [6, 2], // Tue + Sat — primary is Tue
        list: { totalCount: 6, uncheckedCount: 6, aisleCount: 3 },
      });
      const out = buildContent({ kind: 'prepBeforeShop' }, ctx);
      expect(out?.body).toContain('Tuesday');
      expect(out?.body).toContain('6 items');
    });
  });

  describe('buildContent: mealDaily / weeklyPlanning', () => {
    it('always returns a generic body for legacy kinds', () => {
      const a = buildContent({ kind: 'mealDaily' }, baseCtx());
      const b = buildContent({ kind: 'weeklyPlanning' }, baseCtx());
      expect(a?.body).toBeTruthy();
      expect(b?.body).toBeTruthy();
    });
  });
});
