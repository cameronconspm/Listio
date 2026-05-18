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
      return "Paste a recipe and we'll pull out the ingredients — that's Listio+";
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

/** Toast shown when the user dismisses the paywall without subscribing. */
export function contextualPaywallDismissToast(reason: ContextualPaywallReason): {
  title: string;
  message: string;
} {
  switch (reason) {
    case 'list_limit':
      return {
        title: 'Still on the free plan',
        message: 'Your list can have up to 3 items. Subscribe in Listio+ to add more.',
      };
    case 'meal_limit':
      return {
        title: 'Still on the free plan',
        message: 'Your free plan includes 1 planned meal. Subscribe to plan your whole week.',
      };
    case 'recipe_limit':
      return {
        title: 'Still on the free plan',
        message: 'Your free plan includes 1 saved recipe. Subscribe to save unlimited recipes.',
      };
    case 'smart_add':
      return {
        title: 'Smart add needs Listio+',
        message: 'Your entry is still here. Subscribe when you’re ready, or add items one at a time.',
      };
    case 'recipe_url':
      return {
        title: 'Recipe import needs Listio+',
        message: 'Your link is still here. Subscribe when you’re ready to import.',
      };
    case 'recipe_paste':
      return {
        title: 'Recipe extract needs Listio+',
        message: 'Your pasted text is still here. Subscribe when you’re ready to extract.',
      };
    case 'engagement':
    case 'milestone_unlock':
    default:
      return {
        title: 'Listio+ not activated',
        message: 'You can keep using the free plan, or see plans when you’re ready.',
      };
  }
}

export function contextualPaywallBody(reason: ContextualPaywallReason): string {
  switch (reason) {
    case 'recipe_url':
      return 'Import ingredients from a link with Listio+. Subscribe to use it on this device.';
    case 'recipe_paste':
      return 'Turn pasted recipe text into ingredients with Listio+. Subscribe to use it on this device.';
    case 'smart_add':
      return 'Add several items from one description with Smart add. Subscribe to use it on this device.';
    case 'engagement':
      return 'Unlimited lists, recipe imports, Smart add, and more — see plans when you are ready.';
    case 'milestone_unlock':
      return 'Your list, meals, and recipes work together. Subscribe for the full Listio+ experience on this device.';
    case 'list_limit':
      return 'Your free plan covers up to 3 items on your list. Subscribe to add as many as you like, plus recipe imports and Smart add.';
    case 'meal_limit':
      return 'Your free plan covers 1 planned meal. Subscribe to plan your whole week, plus recipe imports and Smart add.';
    case 'recipe_limit':
      return 'Your free plan covers 1 saved recipe. Subscribe to save unlimited recipes, plus Smart add and more.';
    default:
      return 'See plans to subscribe on this device.';
  }
}
