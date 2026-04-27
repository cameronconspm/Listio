export const UNITS = [
  'tbsp',
  'tsp',
  'cup',
  'oz',
  'lb',
  'g',
  'kg',
  'ml',
  'L',
  'count',
  'bunch',
  'clove',
  'jar',
  'ea',
] as const;
export type Unit = (typeof UNITS)[number];

/** UI list order (A–Z). Does not affect `UNIT_PATTERN` / parsing. */
export const UNITS_ALPHABETICAL: readonly Unit[] = [...UNITS].sort((a, b) =>
  a.localeCompare(b, 'en', { sensitivity: 'base' })
);

/** Regex pattern for matching number + unit in natural strings (e.g. "2 lb", "chicken thighs 2 lb"). */
export const UNIT_PATTERN = UNITS.join('|');
