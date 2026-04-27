import { sanitizeListItemInsert } from '../src/utils/sanitizeUserText';
import { MAX_CATEGORY, MAX_ITEM_NAME } from '../src/constants/textLimits';
import type { ZoneKey } from '../src/types/models';

const base = {
  user_id: 'user-1',
  name: 'Milk',
  normalized_name: 'milk',
  category: 'dairy',
  zone_key: 'dairy_eggs' as ZoneKey,
  quantity_value: null as number | null,
  quantity_unit: null as string | null,
  notes: null as string | null,
  is_checked: false,
  linked_meal_ids: [] as string[],
};

describe('sanitizeListItemInsert', () => {
  it('clamps item name to max length', () => {
    const long = 'x'.repeat(MAX_ITEM_NAME + 50);
    const out = sanitizeListItemInsert({ ...base, name: long, normalized_name: 'n' });
    expect(out.name.length).toBe(MAX_ITEM_NAME);
    expect(out.name).toBe('x'.repeat(MAX_ITEM_NAME));
  });

  it('clamps category', () => {
    const out = sanitizeListItemInsert({
      ...base,
      category: 'c'.repeat(MAX_CATEGORY + 80),
    });
    expect(out.category.length).toBe(MAX_CATEGORY);
  });

  it('preserves zone and checked state', () => {
    const out = sanitizeListItemInsert({
      ...base,
      zone_key: 'produce',
      is_checked: true,
    });
    expect(out.zone_key).toBe('produce');
    expect(out.is_checked).toBe(true);
  });
});
