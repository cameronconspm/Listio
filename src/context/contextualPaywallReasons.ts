import {
  FREE_LIST_ITEMS_LIMIT,
  FREE_MEALS_LIMIT,
  FREE_RECIPES_LIMIT,
} from '../constants/freeTierCaps';

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
      return 'Found a recipe online? Let Listio+ do the typing.';
    case 'recipe_paste':
      return 'Paste any recipe and Listio+ turns it into a list.';
    case 'smart_add':
      return 'Rattle off your whole list and Listio+ sorts the rest.';
    case 'engagement':
      return "You're on a roll. Listio+ takes the lid off.";
    case 'milestone_unlock':
      return 'Your plan, recipes, and list, even better together.';
    case 'list_limit':
      return "Your list is really filling up. Go unlimited.";
    case 'meal_limit':
      return 'Big week ahead? Plan all of it with Listio+.';
    case 'recipe_limit':
      return 'Your recipe box is filling up. Keep them all.';
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
        message: `No worries. Your free list holds ${FREE_LIST_ITEMS_LIMIT} items. Listio+ makes it unlimited whenever you want.`,
      };
    case 'meal_limit':
      return {
        title: 'Still on the free plan',
        message: `You've got ${FREE_MEALS_LIMIT} meals on the free plan. Listio+ opens up the whole week when you're ready.`,
      };
    case 'recipe_limit':
      return {
        title: 'Still on the free plan',
        message: `Your free plan keeps ${FREE_RECIPES_LIMIT} recipes. Listio+ saves the rest whenever you like.`,
      };
    case 'smart_add':
      return {
        title: 'No rush',
        message: 'Your text is still here. Add items by hand, or unlock Smart add whenever.',
      };
    case 'recipe_url':
      return {
        title: 'No rush',
        message: "Your link is still here. Import it the moment you unlock Listio+.",
      };
    case 'recipe_paste':
      return {
        title: 'No rush',
        message: 'Your pasted recipe is still here. Extract it whenever you unlock Listio+.',
      };
    case 'engagement':
    case 'milestone_unlock':
    default:
      return {
        title: 'Maybe later',
        message: "All good. The free plan is yours to keep. Plans are here whenever you're curious.",
      };
  }
}

export function contextualPaywallBody(reason: ContextualPaywallReason): string {
  switch (reason) {
    case 'recipe_url':
      return 'Drop in a link and the ingredients land on your list with no typing. Subscribe to use it on this device.';
    case 'recipe_paste':
      return "Paste the recipe text and we'll pull out every ingredient. Subscribe to use it on this device.";
    case 'smart_add':
      return "Describe your whole run (\u201cmilk, a dozen eggs, taco night stuff\u201d) and Smart add builds the list. Subscribe to use it on this device.";
    case 'engagement':
      return "Unlimited lists, recipe imports, Smart add, and more. Take a look whenever you're ready.";
    case 'milestone_unlock':
      return 'Your list, meals, and recipes all talk to each other. Listio+ unlocks the whole thing on this device.';
    case 'list_limit':
      return `Your free plan holds ${FREE_LIST_ITEMS_LIMIT} items, plenty for most weeks. Go unlimited with Listio+, and pick up recipe imports and Smart add too.`;
    case 'meal_limit':
      return `Your free plan plans ${FREE_MEALS_LIMIT} meals. Listio+ opens up your whole calendar, plus recipe imports and Smart add.`;
    case 'recipe_limit':
      return `Your free plan keeps ${FREE_RECIPES_LIMIT} recipes. Listio+ saves as many as you cook, plus Smart add and more.`;
    default:
      return 'See plans to subscribe on this device.';
  }
}
