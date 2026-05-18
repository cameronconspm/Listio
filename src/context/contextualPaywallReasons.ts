export type ContextualPaywallReason =
  | 'recipe_url'
  | 'recipe_paste'
  | 'smart_add'
  | 'engagement'
  | 'milestone_unlock'
  | 'list_limit'
  | 'meal_limit'
  | 'recipe_limit';

export function contextualPaywallHeadline(reason: ContextualPaywallReason): string {
  switch (reason) {
    case 'recipe_url':
      return "Import recipes from anywhere — that's Listio+";
    case 'recipe_paste':
      return "Paste a recipe and let AI extract ingredients — that's Listio+";
    case 'smart_add':
      return "Describe a whole list in one go — that's Listio+";
    case 'engagement':
      return "You're getting value from Listio — unlock the rest with Listio+";
    case 'milestone_unlock':
      return 'Keep everything connected with Listio+';
    case 'list_limit':
      return 'Unlock unlimited list items with Listio+';
    case 'meal_limit':
      return 'Plan unlimited meals with Listio+';
    case 'recipe_limit':
      return 'Save unlimited recipes with Listio+';
    default:
      return 'Listio+';
  }
}

export function contextualPaywallBody(reason: ContextualPaywallReason): string {
  switch (reason) {
    case 'recipe_url':
      return 'URL import uses AI to pull ingredients into your recipe. Subscribe to use it on this device.';
    case 'recipe_paste':
      return 'AI parsing turns pasted text into structured ingredients. Subscribe to use it on this device.';
    case 'smart_add':
      return 'Smart add uses AI to categorize multiple items at once. Subscribe to use it on this device.';
    case 'engagement':
      return 'Cloud sync, smart categorization, AI recipe tools, and more — see plans when you are ready.';
    case 'milestone_unlock':
      return 'Your list, meals, and recipes are working together. Subscribe to unlock sync, AI tools, and the full experience on this device.';
    case 'list_limit':
      return 'Your free plan covers up to 3 items on your list. Subscribe to add as many as you like and unlock sync, AI tools, and more.';
    case 'meal_limit':
      return 'Your free plan covers 1 planned meal. Subscribe to plan your whole week and unlock sync, AI tools, and more.';
    case 'recipe_limit':
      return 'Your free plan covers 1 saved recipe. Subscribe to build your full recipe collection and unlock sync, AI tools, and more.';
    default:
      return 'See plans to subscribe on this device.';
  }
}
