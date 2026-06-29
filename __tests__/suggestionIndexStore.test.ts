import {
  __resetSuggestionIndexForTests,
  patchSuggestionIndex,
  searchSuggestionIndex,
} from '../src/services/suggestionIndexStore';

describe('suggestionIndexStore', () => {
  beforeEach(() => {
    __resetSuggestionIndexForTests();
  });

  it('patches and searches by prefix', () => {
    patchSuggestionIndex([
      { display_name: 'Ribeye Steak', normalized_name: 'ribeye', source: 'list' },
      { display_name: 'Baby Ribs', normalized_name: 'ribs', source: 'recipe' },
    ]);
    const rows = searchSuggestionIndex('ri', 5);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.normalized_name === 'ribeye' || r.normalized_name === 'ribs')).toBe(
      true
    );
  });

  it('dedupes by normalized name and bumps frequency', () => {
    patchSuggestionIndex([
      { display_name: 'Milk', normalized_name: 'milk', source: 'list' },
    ]);
    patchSuggestionIndex([
      { display_name: 'Milk', normalized_name: 'milk', source: 'recent', last_used_at: 100 },
    ]);
    const rows = searchSuggestionIndex('mil', 5);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.frequency).toBe(2);
  });
});
