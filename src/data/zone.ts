import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { ZoneKey } from '../types/models';

type IonName = ComponentProps<typeof Ionicons>['name'];

/** Ionicons for each list section (Apple-style list section icons) */
export const ZONE_ICONS: Record<ZoneKey, IonName> = {
  produce: 'leaf',
  bakery_deli: 'restaurant',
  meat_seafood: 'fish',
  dairy_eggs: 'nutrition',
  frozen: 'snow',
  pantry: 'cube',
  snacks_drinks: 'fast-food',
  household_cleaning: 'sparkles',
  personal_care: 'person',
  other: 'ellipsis-horizontal',
};

export const ZONE_KEYS: ZoneKey[] = [
  'produce',
  'bakery_deli',
  'meat_seafood',
  'dairy_eggs',
  'frozen',
  'pantry',
  'snacks_drinks',
  'household_cleaning',
  'personal_care',
  'other',
];

export const ZONE_LABELS: Record<ZoneKey, string> = {
  produce: 'Produce',
  bakery_deli: 'Bakery & Deli',
  meat_seafood: 'Meat & Seafood',
  dairy_eggs: 'Dairy & Eggs',
  frozen: 'Frozen',
  pantry: 'Pantry',
  snacks_drinks: 'Snacks & Drinks',
  household_cleaning: 'Household & Cleaning',
  personal_care: 'Personal Care',
  other: 'Other',
};

export const DEFAULT_ZONE_ORDER: ZoneKey[] = [...ZONE_KEYS];
