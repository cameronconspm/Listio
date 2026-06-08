import type { ZoneKey } from '../types/models';
import type { ColorScheme } from '../design/theme';

type ZoneColorPair = { light: string; dark: string };

/**
 * Expressive, food-appropriate accent per aisle — gives the Shop/List screen
 * energy and makes each section instantly recognizable (Apple Reminders-style
 * colored category icons). Dark variants are lifted for contrast on dark fills.
 */
export const ZONE_COLORS: Record<ZoneKey, ZoneColorPair> = {
  produce: { light: '#2E9E5B', dark: '#4CC07E' },
  bakery_deli: { light: '#C98A2E', dark: '#E0A94B' },
  meat_seafood: { light: '#D8543F', dark: '#F0715C' },
  dairy_eggs: { light: '#3B82C4', dark: '#5BA3E0' },
  frozen: { light: '#2BA6C4', dark: '#4FC4E0' },
  pantry: { light: '#D2792E', dark: '#EE9A4F' },
  snacks_drinks: { light: '#8A5CD0', dark: '#A985E8' },
  household_cleaning: { light: '#2BA89A', dark: '#4CC9B8' },
  personal_care: { light: '#C95C9A', dark: '#E87FB6' },
  other: { light: '#8A8A8E', dark: '#9E9EA3' },
};

/** Solid aisle hue for the current color scheme. */
export function zoneColor(zone: ZoneKey, scheme: ColorScheme): string {
  const pair = ZONE_COLORS[zone] ?? ZONE_COLORS.other;
  return scheme === 'dark' ? pair.dark : pair.light;
}

/** Low-opacity aisle hue for the icon chip background. */
export function zoneSoftColor(zone: ZoneKey, scheme: ColorScheme): string {
  return zoneColor(zone, scheme) + (scheme === 'dark' ? '2E' : '1F');
}
