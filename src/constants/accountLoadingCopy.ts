/** Icon row for account / tab bootstrap loading (matches Smart Add + recipe import tone). */
export const ACCOUNT_LOADING_ICONS = [
  'sparkles',
  'list-outline',
  'restaurant-outline',
  'book-outline',
  'nutrition-outline',
] as const;

export const ACCOUNT_LOADING_TITLE = 'Setting things up…';

export const ACCOUNT_LOADING_DETAIL =
  'We’re syncing your list, meals, and recipes so everything is ready when you arrive.';

export const ACCOUNT_LOADING_STATUS_MESSAGES = [
  'Gathering your account details…',
  'Loading your shopping list…',
  'Pulling in your meals…',
  'Fetching your recipes…',
  'Almost ready…',
] as const;

export const SESSION_LOADING_TITLE = 'Signing you in…';

export const SESSION_LOADING_DETAIL = 'Hang tight while we verify your account.';

export const SESSION_LOADING_STATUS_MESSAGES = [
  'Checking your session…',
  'Gathering your account details…',
  'Preparing your list…',
  'Almost there…',
] as const;
