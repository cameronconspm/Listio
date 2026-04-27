import { deriveHomeListModel, safeZoneOrderOrDefault } from '../src/screens/home/homeScreenListDerived';
import { DEFAULT_ZONE_ORDER } from '../src/data/zone';
import type { ListItem } from '../src/types/models';

function item(overrides: Partial<ListItem> & Pick<ListItem, 'id' | 'zone_key'>): ListItem {
  return {
    user_id: 'u',
    name: 'x',
    normalized_name: 'x',
    category: 'other',
    quantity_value: null,
    quantity_unit: null,
    notes: null,
    is_checked: false,
    linked_meal_ids: [],
    brand_preference: null,
    substitute_allowed: true,
    priority: 'normal',
    is_recurring: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('deriveHomeListModel', () => {
  it('orders shop mode with unchecked zones first', () => {
    const safeItems: ListItem[] = [
      item({ id: '1', zone_key: 'produce', is_checked: true }),
      item({ id: '2', zone_key: 'dairy_eggs', is_checked: false }),
    ];
    const m = deriveHomeListModel(safeItems, DEFAULT_ZONE_ORDER, 'shop', 'all');
    const zones = m.orderedSections.map((s) => s.zone);
    const dairyIdx = zones.indexOf('dairy_eggs');
    const produceIdx = zones.indexOf('produce');
    expect(dairyIdx).toBeGreaterThanOrEqual(0);
    expect(produceIdx).toBeGreaterThanOrEqual(0);
    expect(dairyIdx).toBeLessThan(produceIdx);
  });

  it('filters to a single zone', () => {
    const safeItems: ListItem[] = [
      item({ id: '1', zone_key: 'produce', is_checked: false }),
      item({ id: '2', zone_key: 'dairy_eggs', is_checked: false }),
    ];
    const m = deriveHomeListModel(safeItems, DEFAULT_ZONE_ORDER, 'plan', 'dairy_eggs');
    expect(m.sections).toHaveLength(1);
    expect(m.sections[0]?.zone).toBe('dairy_eggs');
  });

  it('sorts items alphabetically within each section (by display name)', () => {
    const safeItems: ListItem[] = [
      item({ id: 'a', zone_key: 'produce', name: 'Zebra', normalized_name: 'zebra' }),
      item({ id: 'b', zone_key: 'produce', name: 'Apple', normalized_name: 'apple' }),
      item({ id: 'c', zone_key: 'dairy_eggs', name: 'Milk', normalized_name: 'milk' }),
    ];
    const m = deriveHomeListModel(safeItems, DEFAULT_ZONE_ORDER, 'plan', 'all');
    const produce = m.orderedSections.find((s) => s.zone === 'produce');
    expect(produce?.items.map((i) => i.name)).toEqual(['Apple', 'Zebra']);
    const dairy = m.orderedSections.find((s) => s.zone === 'dairy_eggs');
    expect(dairy?.items.map((i) => i.name)).toEqual(['Milk']);
  });
});

describe('safeZoneOrderOrDefault', () => {
  it('falls back to DEFAULT_ZONE_ORDER', () => {
    expect(safeZoneOrderOrDefault(null)).toEqual(DEFAULT_ZONE_ORDER);
  });
});
