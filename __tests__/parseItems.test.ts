import { parseItems, parseSingleEntry, parseBulkToItems } from '../src/utils/parseItems';

describe('parseItems', () => {
  it('splits by newlines', () => {
    expect(parseItems('a\nb\nc')).toEqual(['a', 'b', 'c']);
  });

  it('splits by commas', () => {
    expect(parseItems('a, b, c')).toEqual(['a', 'b', 'c']);
  });

  it('splits by newlines and commas', () => {
    expect(parseItems('a, b\nc')).toEqual(['a', 'b', 'c']);
  });

  it('trims each item', () => {
    expect(parseItems('  a  \n  b  ')).toEqual(['a', 'b']);
  });

  it('filters empty strings', () => {
    expect(parseItems('a\n\nb\n')).toEqual(['a', 'b']);
  });

  it('returns empty array for empty string', () => {
    expect(parseItems('')).toEqual([]);
  });

  it('returns empty array for whitespace only', () => {
    expect(parseItems('   \n  ,  ')).toEqual([]);
  });
});

describe('parseSingleEntry', () => {
  it('parses plain item', () => {
    expect(parseSingleEntry('milk')).toEqual({ name: 'milk', quantity: 1, unit: 'ea' });
  });

  it('parses xN pattern', () => {
    expect(parseSingleEntry('bananas x6')).toEqual({ name: 'bananas', quantity: 6, unit: 'ea' });
  });

  it('parses number + unit', () => {
    expect(parseSingleEntry('chicken thighs 2 lb')).toEqual({
      name: 'chicken thighs',
      quantity: 2,
      unit: 'lb',
    });
  });

  it('parses leading number', () => {
    expect(parseSingleEntry('2 avocados')).toEqual({ name: 'avocados', quantity: 2, unit: 'ea' });
  });

  it('parses bread 1', () => {
    expect(parseSingleEntry('bread 1')).toEqual({ name: 'bread', quantity: 1, unit: 'ea' });
  });
});

describe('parseBulkToItems', () => {
  it('parses multi-line bulk text', () => {
    const result = parseBulkToItems('milk\nbananas x6\n2 avocados');
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ name: 'milk', quantity: 1, unit: 'ea' });
    expect(result[1]).toEqual({ name: 'bananas', quantity: 6, unit: 'ea' });
    expect(result[2]).toEqual({ name: 'avocados', quantity: 2, unit: 'ea' });
  });
});
