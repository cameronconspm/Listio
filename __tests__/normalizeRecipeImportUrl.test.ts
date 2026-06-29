import { normalizeRecipeImportUrl } from '../src/utils/normalizeRecipeImportUrl';

describe('normalizeRecipeImportUrl', () => {
  it('adds https when scheme is missing', () => {
    expect(normalizeRecipeImportUrl('example.com/recipe')).toBe('https://example.com/recipe');
  });

  it('preserves existing https URLs', () => {
    expect(normalizeRecipeImportUrl('https://example.com/recipe?id=1')).toBe(
      'https://example.com/recipe?id=1'
    );
  });

  it('trims whitespace', () => {
    expect(normalizeRecipeImportUrl('  https://example.com/recipe  ')).toBe('https://example.com/recipe');
  });

  it('returns empty string unchanged', () => {
    expect(normalizeRecipeImportUrl('   ')).toBe('');
  });
});
