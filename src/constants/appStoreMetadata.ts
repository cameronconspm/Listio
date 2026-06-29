/**
 * App Store Connect copy — list-first repositioning for power grocery-list users.
 * Paste into App Store Connect metadata fields when submitting.
 */

export const APP_STORE_SUBTITLE = 'Aisle-sorted lists. Shop faster.';

export const APP_STORE_PROMOTIONAL_TEXT =
  'Your beautiful grocery list, sorted by store aisle. Shop mode, shared lists, and meal planning when you need them.';

export const APP_STORE_DESCRIPTION = `Listio is the grocery list built for how you actually shop — sorted by aisle, designed to feel premium, and ready when you walk into the store.

WHAT MAKES LISTIO DIFFERENT
• Aisle-sorted lists — items group by produce, dairy, frozen, and more so you move through the store once
• Shop mode — check items off with a progress bar while you shop
• Shared lists — invite someone to shop from the same list (Listio+ for unlimited scale)
• Beautiful, iOS-native design — fast, calm, and built for iPhone

ALSO INCLUDED
• Meal planning and recipes — send ingredients to your list in one tap
• Smart Add and recipe import — paste or import recipes with AI (Listio+)

Listio+ unlocks unlimited items, meals, recipes, and AI features. The free plan includes a generous list to get started.

Built for iPhone. Your list, sorted by aisle.`;

export const APP_STORE_KEYWORDS =
  'grocery,shopping list,shared list,couples,meal plan,recipes,aisle,store,checklist,food';

/** Suggested screenshot order for App Store Connect */
export const APP_STORE_SCREENSHOT_ORDER = [
  'Zone-grouped list in shop mode with progress bar',
  'Quick add item with aisle sorting',
  'Shared household list (Profile → Share list)',
  'Mascot / premium design moment',
  'Meals and recipes as bonus depth',
] as const;

/** TestFlight interview prompt */
export const TESTFLIGHT_FEEDBACK_PROMPT =
  'Would this replace your current grocery list app? Why or why not?';
