import { parseQuantity } from '../src/utils/quantities';

describe('parseQuantity', () => {
  it('parses value and unit', () => {
    expect(parseQuantity('2 lb')).toEqual({ value: 2, unit: 'lb' });
  });

  it('parses decimal value', () => {
    expect(parseQuantity('1.5 cups')).toEqual({ value: 1.5, unit: 'cups' });
  });

  it('parses value only when no unit', () => {
    expect(parseQuantity('3')).toEqual({ value: 3, unit: null });
  });

  it('parses unit only when no leading number', () => {
    expect(parseQuantity('cups')).toEqual({ value: null, unit: null });
  });

  it('returns null for empty string', () => {
    expect(parseQuantity('')).toEqual({ value: null, unit: null });
  });

  it('parses from start of string', () => {
    expect(parseQuantity('2 lb chicken')).toEqual({ value: 2, unit: 'lb' });
  });
});
