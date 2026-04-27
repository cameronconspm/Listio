import { mapParsedRecipeDraftToForm } from '../src/screens/recipes/recipeAiImport';
import type { ParsedRecipeDraft } from '../src/types/api';

describe('mapParsedRecipeDraftToForm', () => {
  it('maps parsed values into form strings', () => {
    const draft: ParsedRecipeDraft = {
      name: 'Weeknight Pasta',
      servings: 4,
      total_time_minutes: 25,
      category: 'dinner',
      instructions: 'Boil pasta\nMix sauce',
      notes: 'Use parmesan',
      recipe_url: 'https://example.com/pasta',
      ingredients: [
        { name: 'Pasta', quantity_value: 1, quantity_unit: 'lb', notes: null },
        { name: 'Parmesan', quantity_value: 0.5, quantity_unit: 'cup', notes: 'grated' },
      ],
    };

    expect(mapParsedRecipeDraftToForm(draft)).toEqual({
      name: 'Weeknight Pasta',
      servings: '4',
      totalTimeMinutes: '25',
      category: 'dinner',
      instructions: 'Boil pasta\nMix sauce',
      notes: 'Use parmesan',
      recipeUrl: 'https://example.com/pasta',
      ingredients: [
        { name: 'Pasta', quantity_value: '1', quantity_unit: 'lb', notes: '' },
        { name: 'Parmesan', quantity_value: '0.5', quantity_unit: 'cup', notes: 'grated' },
      ],
    });
  });

  it('splits compound ingredient name into qty and unit', () => {
    const draft: ParsedRecipeDraft = {
      name: 'Test',
      servings: null,
      total_time_minutes: null,
      category: null,
      instructions: null,
      notes: null,
      recipe_url: null,
      ingredients: [{ name: '185g cold water', quantity_value: null, quantity_unit: null, notes: null }],
    };
    expect(mapParsedRecipeDraftToForm(draft).ingredients[0]).toMatchObject({
      name: 'cold water',
      quantity_value: '185',
      quantity_unit: 'g',
    });
  });

  it('drops empty ingredient names and falls back unit', () => {
    const draft: ParsedRecipeDraft = {
      name: null,
      servings: null,
      total_time_minutes: null,
      category: null,
      instructions: null,
      notes: null,
      recipe_url: null,
      ingredients: [
        { name: '  ', quantity_value: null, quantity_unit: null, notes: null },
        { name: 'Eggs', quantity_value: 2, quantity_unit: null, notes: null },
      ],
    };

    expect(mapParsedRecipeDraftToForm(draft)).toEqual({
      name: '',
      servings: '',
      totalTimeMinutes: '',
      category: null,
      instructions: '',
      notes: '',
      recipeUrl: '',
      ingredients: [{ name: 'Eggs', quantity_value: '2', quantity_unit: 'ea', notes: '' }],
    });
  });
});
