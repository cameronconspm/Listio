import {
  recipeAiImportStatusMessages,
  recipeAiImportTitles,
} from '../src/components/recipes/RecipeAiImportOverlay';

describe('recipeAiImportOverlay copy', () => {
  it('returns distinct status messages for link vs paste', () => {
    const link = recipeAiImportStatusMessages('link');
    const paste = recipeAiImportStatusMessages('paste');
    expect(link[0]).toMatch(/fetch/i);
    expect(paste[0]).toMatch(/reading your recipe/i);
    expect(link).not.toEqual(paste);
  });

  it('returns phase-specific titles', () => {
    expect(recipeAiImportTitles('link', 'parsing').title).toMatch(/importing/i);
    expect(recipeAiImportTitles('paste', 'success').title).toMatch(/extracted/i);
    expect(recipeAiImportTitles('link', 'failure').title).toMatch(/could not import/i);
  });
});
