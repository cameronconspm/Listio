import { linkedMealRowMetaFromIds, type LinkedMealRowMeta } from '../src/utils/mealLabel';

describe('linkedMealRowMetaFromIds', () => {
  it('returns single meal meta when one id', () => {
    const map = new Map<string, LinkedMealRowMeta>([
      ['a', { display: 'Sun · dinner', accessibilityLabel: 'Sunday dinner' }],
    ]);
    expect(linkedMealRowMetaFromIds({ linked_meal_ids: ['a'] }, map)).toEqual({
      display: 'Sun · dinner',
      accessibilityLabel: 'Sunday dinner',
    });
  });

  it('aggregates when multiple meals', () => {
    const map = new Map<string, LinkedMealRowMeta>([
      ['a', { display: 'Sun · dinner', accessibilityLabel: 'Sunday dinner' }],
      ['b', { display: 'Mon · lunch', accessibilityLabel: 'Monday lunch' }],
    ]);
    expect(linkedMealRowMetaFromIds({ linked_meal_ids: ['a', 'b'] }, map)).toEqual({
      display: 'Sun · dinner +1',
      accessibilityLabel: 'Sunday dinner; Monday lunch',
    });
  });
});
