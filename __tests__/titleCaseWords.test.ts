import { titleCaseWords } from '../src/utils/titleCaseWords';

describe('titleCaseWords', () => {
  it('title-cases each word', () => {
    expect(titleCaseWords('chicken breasts')).toBe('Chicken Breasts');
    expect(titleCaseWords('CHICKEN BREASTS')).toBe('Chicken Breasts');
  });

  it('trims and collapses whitespace', () => {
    expect(titleCaseWords('  milk  ')).toBe('Milk');
    expect(titleCaseWords('a   b')).toBe('A B');
  });

  it('returns empty for empty or whitespace', () => {
    expect(titleCaseWords('')).toBe('');
    expect(titleCaseWords('   ')).toBe('');
  });

  it('leaves digit-only tokens unchanged', () => {
    expect(titleCaseWords('2')).toBe('2');
    expect(titleCaseWords('item 12 pack')).toBe('Item 12 Pack');
  });

  it('title-cases from first letter in token', () => {
    expect(titleCaseWords('(organic) milk')).toBe('(Organic) Milk');
  });
});
