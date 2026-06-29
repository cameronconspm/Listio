import { scoreSuggestionMatch, searchCatalogSuggestions } from '../shared/groceryResolverCore';

describe('scoreSuggestionMatch', () => {
  it('matches prefix on display and key', () => {
    expect(scoreSuggestionMatch('ribs', 'ribs', 'ri')).toBe(0);
    expect(scoreSuggestionMatch('brown rice', 'rice', 'ri')).toBe(0);
  });

  it('matches word-start but not mid-word substring for short queries', () => {
    expect(scoreSuggestionMatch('baby ribs', 'ribs', 'ri')).toBe(0);
    expect(scoreSuggestionMatch('dried oregano', 'oregano', 'ri')).toBeNull();
    expect(scoreSuggestionMatch('ground turmeric', 'turmeric', 'ri')).toBeNull();
  });

  it('matches a later word start in multi-word display names', () => {
    expect(scoreSuggestionMatch('beef ribeye', 'beef ribeye', 'rib')).toBe(1);
  });
});

describe('searchCatalogSuggestions with new matcher', () => {
  it('returns ribs and ribeye for "ri"', () => {
    const rows = searchCatalogSuggestions('ri', 10);
    const names = rows.map((r) => r.display_name.toLowerCase());
    expect(names.some((n) => n.includes('rib'))).toBe(true);
    expect(names.some((n) => n.includes('dried'))).toBe(false);
  });

  it('still finds salt for "sal"', () => {
    const rows = searchCatalogSuggestions('sal', 5);
    expect(rows.some((r) => r.normalized_name === 'salt')).toBe(true);
  });
});
