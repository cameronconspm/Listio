import { normalizeUnitValue } from '../src/components/ui/unitSelection';

describe('normalizeUnitValue', () => {
  it('normalizes valid units case-insensitively', () => {
    expect(normalizeUnitValue('CUP')).toBe('cup');
    expect(normalizeUnitValue('ea')).toBe('ea');
  });

  it('falls back to ea for unknown or empty values', () => {
    expect(normalizeUnitValue('unknown')).toBe('ea');
    expect(normalizeUnitValue(undefined)).toBe('ea');
    expect(normalizeUnitValue(null)).toBe('ea');
  });
});
