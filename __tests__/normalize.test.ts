import { normalize } from '../src/utils/normalize';

describe('normalize', () => {
  it('lowercases', () => {
    expect(normalize('MILK')).toBe('milk');
  });

  it('trims', () => {
    expect(normalize('  milk  ')).toBe('milk');
  });

  it('collapses multiple spaces', () => {
    expect(normalize('chicken   thighs')).toBe('chicken thighs');
  });

  it('combines trim, lowercase, and collapse', () => {
    expect(normalize('  Chicken   Thighs  2  lb  ')).toBe('chicken thighs 2 lb');
  });

  it('returns empty string for empty input', () => {
    expect(normalize('')).toBe('');
  });
});
