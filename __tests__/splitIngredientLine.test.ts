import { splitCompoundIngredientLine } from '../src/utils/splitIngredientLine';

describe('splitCompoundIngredientLine', () => {
  it('splits glued quantity+unit from name', () => {
    expect(splitCompoundIngredientLine('280g bread flour')).toEqual({
      name: 'bread flour',
      quantity_value: 280,
      quantity_unit: 'g',
      notes: null,
    });
  });

  it('keeps optional parenthetical as notes', () => {
    expect(splitCompoundIngredientLine('3g sugar (optional)')).toEqual({
      name: 'sugar',
      quantity_value: 3,
      quantity_unit: 'g',
      notes: 'optional',
    });
  });
});
