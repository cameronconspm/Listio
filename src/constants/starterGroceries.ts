import type { ZoneKey } from '../types/models';

/**
 * Broadly-appealing staples offered as one-tap chips in onboarding so a new
 * user can build a real, aisle-sorted list in seconds — and land on a list
 * that already feels useful instead of an empty screen.
 */
export type StarterGroceryItem = {
  name: string;
  zone_key: ZoneKey;
};

export const STARTER_GROCERIES: StarterGroceryItem[] = [
  { name: 'Bananas', zone_key: 'produce' },
  { name: 'Apples', zone_key: 'produce' },
  { name: 'Spinach', zone_key: 'produce' },
  { name: 'Tomatoes', zone_key: 'produce' },
  { name: 'Milk', zone_key: 'dairy_eggs' },
  { name: 'Eggs', zone_key: 'dairy_eggs' },
  { name: 'Yogurt', zone_key: 'dairy_eggs' },
  { name: 'Bread', zone_key: 'bakery_deli' },
  { name: 'Chicken breast', zone_key: 'meat_seafood' },
  { name: 'Ground beef', zone_key: 'meat_seafood' },
  { name: 'Rice', zone_key: 'pantry' },
  { name: 'Pasta', zone_key: 'pantry' },
  { name: 'Coffee', zone_key: 'snacks_drinks' },
  { name: 'Paper towels', zone_key: 'household_cleaning' },
];
