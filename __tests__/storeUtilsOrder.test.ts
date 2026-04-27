import { ZONE_KEYS } from '../src/data/zone';
import {
  dedupeStoresForDisplay,
  getZoneOrderFromStore,
  getAisleOrderFromStore,
  getAisleCount,
} from '../src/utils/storeUtils';
import type { StoreProfile, ZoneKey } from '../src/types/models';

describe('storeUtils zone order', () => {
  it('returns default zone order when store is null', () => {
    expect(getZoneOrderFromStore(null)).toEqual(ZONE_KEYS);
  });

  it('uses zone_order when no aisle_order', () => {
    const custom: ZoneKey[] = ['frozen', 'produce'];
    const store: StoreProfile = {
      id: 's1',
      user_id: 'u',
      name: 'Test',
      store_type: 'generic',
      zone_order: custom,
      is_default: false,
    };
    expect(getZoneOrderFromStore(store)).toEqual(custom);
  });

  it('builds aisle rows from store without aisle_order', () => {
    const store: StoreProfile = {
      id: 's1',
      user_id: 'u',
      name: 'Test',
      store_type: 'generic',
      zone_order: ['produce'],
      is_default: false,
    };
    const aisles = getAisleOrderFromStore(store);
    expect(aisles).toEqual([{ type: 'builtin', key: 'produce' }]);
  });

  it('counts aisles from aisle_order when present', () => {
    const store: StoreProfile = {
      id: 's1',
      user_id: 'u',
      name: 'Test',
      store_type: 'generic',
      zone_order: ['produce'],
      is_default: false,
      aisle_order: [
        { type: 'builtin', key: 'produce' },
        { type: 'custom', id: 'c1', name: 'Bulk', icon: '🫙' },
      ],
    };
    expect(getAisleCount(store)).toBe(2);
  });
});

describe('dedupeStoresForDisplay', () => {
  const base = {
    user_id: 'u',
    store_type: 'generic' as const,
    zone_order: [...ZONE_KEYS],
    is_default: false,
  };

  it('merges same place_id (keeps default)', () => {
    const a: StoreProfile = {
      ...base,
      id: '1',
      name: 'Safeway',
      place_id: 'ChIJabc',
      is_default: false,
      created_at: '2020-01-01T00:00:00Z',
    };
    const b: StoreProfile = {
      ...base,
      id: '2',
      name: 'Safeway',
      place_id: 'ChIJabc',
      is_default: true,
      created_at: '2021-01-01T00:00:00Z',
    };
    const out = dedupeStoresForDisplay([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('2');
  });

  it('merges same name within 250m (keeps place-linked row)', () => {
    const lat = 37.77;
    const lng = -122.42;
    const a: StoreProfile = {
      ...base,
      id: '1',
      name: 'Safeway',
      place_id: null,
      latitude: lat,
      longitude: lng,
      created_at: '2020-01-01T00:00:00Z',
    };
    const b: StoreProfile = {
      ...base,
      id: '2',
      name: 'Safeway',
      place_id: 'ChIJx',
      latitude: lat + 0.0001,
      longitude: lng,
      created_at: '2021-01-01T00:00:00Z',
    };
    const out = dedupeStoresForDisplay([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('2');
  });
});
