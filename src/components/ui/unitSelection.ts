import { UNITS, UNITS_ALPHABETICAL, type Unit } from '../../data/units';

export const UNIT_SELECTION_MAX_HEIGHT = 280;

export function normalizeUnitValue(value: string | null | undefined): Unit {
  const normalizedValue = value?.toLowerCase() ?? 'ea';
  return UNITS.includes(normalizedValue as Unit) ? (normalizedValue as Unit) : 'ea';
}

export { UNITS_ALPHABETICAL };
