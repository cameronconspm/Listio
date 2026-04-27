import {
  formatScaledIngredientQuantityDisplay,
  normalizeIngredientUnit,
} from '../src/utils/formatScaledIngredientAmount';

describe('normalizeIngredientUnit', () => {
  it('maps common aliases', () => {
    expect(normalizeIngredientUnit('Tablespoons')).toBe('tbsp');
    expect(normalizeIngredientUnit('teaspoon')).toBe('tsp');
    expect(normalizeIngredientUnit('grams')).toBe('g');
  });
});

describe('formatScaledIngredientQuantityDisplay', () => {
  describe('US volume', () => {
    it('converts many tsp to tbsp + tsp', () => {
      const s = formatScaledIngredientQuantityDisplay(4, 'tsp');
      expect(s).toContain('tbsp');
      expect(s).toContain('tsp');
    });

    it('formats cup with thirds', () => {
      const s = formatScaledIngredientQuantityDisplay(1 / 3, 'cup');
      expect(s).toMatch(/⅓|1\/3/);
      expect(s.toLowerCase()).toContain('cup');
    });

    it('promotes tbsp to cup when large', () => {
      const s = formatScaledIngredientQuantityDisplay(20, 'tbsp');
      expect(s.toLowerCase()).toContain('cup');
    });
  });

  describe('mass', () => {
    it('rounds grams and promotes to kg', () => {
      expect(formatScaledIngredientQuantityDisplay(1500, 'g')).toMatch(/kg/);
      expect(formatScaledIngredientQuantityDisplay(14, 'g')).toMatch(/14 g/);
    });

    it('splits lb and oz', () => {
      const s = formatScaledIngredientQuantityDisplay(1.5, 'lb');
      expect(s.toLowerCase()).toContain('lb');
      expect(s).toMatch(/oz/);
    });
  });

  describe('ml / L', () => {
    it('shows ml for sub-liter L input', () => {
      expect(formatScaledIngredientQuantityDisplay(0.4, 'L')).toMatch(/ml/);
    });

    it('shows L for large ml', () => {
      expect(formatScaledIngredientQuantityDisplay(1200, 'ml')).toMatch(/\bL\b/);
    });
  });

  describe('count-like', () => {
    it('rounds eggs to whole numbers using name', () => {
      expect(formatScaledIngredientQuantityDisplay(2.4, 'ea', 'large eggs')).toBe('2');
    });

    it('rounds cloves to halves', () => {
      expect(formatScaledIngredientQuantityDisplay(2.3, 'clove', 'garlic')).toBe('2 ½ cloves');
    });
  });
});
