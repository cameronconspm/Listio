import { searchItemNameSuggestions } from '../src/services/itemNameSuggestions';
import type { RecentItem } from '../src/services/recentItemsStore';

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

  it('returns empty when query is empty', () => {
    const rows = searchItemNameSuggestions('', { recentItems: recent, limit: 3 });
    expect(rows).toEqual([]);
  });

  it('excludes dried spices for short "ri" query', () => {
    const rows = searchItemNameSuggestions('ri', { limit: 8 });
    const labels = rows.map((r) => r.display_name.toLowerCase());
    expect(labels.some((n) => n.includes('rib'))).toBe(true);
    expect(labels.every((n) => !n.includes('dried'))).toBe(true);
  });

  it('adds typed fallback row when requested', () => {
    const rows = searchItemNameSuggestions('ribz', {
      includeTypedFallback: true,
      limit: 5,
    });
    expect(rows.some((r) => r.isTypedFallback)).toBe(true);
  });

  it('returns empty for whitespace-only query without recents', () => {
    expect(searchItemNameSuggestions('   ', { recentItems: [] })).toEqual([]);
  });
});
