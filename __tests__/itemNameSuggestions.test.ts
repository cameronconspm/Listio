import { searchCatalogSuggestions } from '../shared/groceryResolverCore';
import { searchItemNameSuggestions } from '../src/services/itemNameSuggestions';
import type { RecentItem } from '../src/services/recentItemsStore';

describe('searchCatalogSuggestions', () => {
  it('finds salt and pepper in pantry spices', () => {
    const salt = searchCatalogSuggestions('sal', 5);
    expect(salt.some((r) => r.normalized_name === 'salt')).toBe(true);

    const pepper = searchCatalogSuggestions('pep', 8);
    expect(pepper.some((r) => r.normalized_name === 'black pepper')).toBe(true);
  });

  it('finds bell pepper in produce', () => {
    const rows = searchCatalogSuggestions('bell', 5);
    expect(rows.some((r) => r.display_name.toLowerCase().includes('bell pepper'))).toBe(true);
  });
});

describe('searchItemNameSuggestions', () => {
  const recent: RecentItem[] = [
    {
      normalized_name: 'oat milk',
      display_name: 'Oat Milk',
      last_used_at: Date.now(),
      last_unit: 'gal',
    },
  ];

  it('ranks prefix matches and merges sources', () => {
    const rows = searchItemNameSuggestions('sal', {
      recentItems: recent,
      listItemNames: ['Sea salt flakes'],
      limit: 5,
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].display_name.toLowerCase()).toContain('sal');
    const keys = new Set(rows.map((r) => r.normalized_name));
    expect(keys.size).toBe(rows.length);
  });

  it('prefers recent items over catalog for same tier', () => {
    const rows = searchItemNameSuggestions('oat', { recentItems: recent, limit: 3 });
    expect(rows[0]?.source).toBe('recent');
    expect(rows[0]?.display_name).toBe('Oat Milk');
  });

  it('returns empty for whitespace-only query', () => {
    expect(searchItemNameSuggestions('   ', { recentItems: recent })).toEqual([]);
  });
});
