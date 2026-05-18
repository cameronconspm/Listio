import { OFFICIAL_LISTIO_TEST_ACCOUNT_EMAIL } from './officialTestAccount';
import { PRIVACY_POLICY_URL, SUPPORT_HELP_CENTER_URL, TERMS_OF_USE_URL } from './legalUrls';
import {
  FREE_LIST_ITEMS_LIMIT,
  FREE_MEALS_LIMIT,
  FREE_RECIPES_LIMIT,
} from '../services/freeTierLimits';

/**
 * Copy-paste into App Store Connect → App Review Information → Notes.
 * Keep in sync with free-tier limits and premium feature gates in the app.
 */
export const APP_STORE_REVIEW_NOTES = `Listio — Notes for App Review

Demo account
- Email: ${OFFICIAL_LISTIO_TEST_ACCOUNT_EMAIL}
- Password: (set in your secure store / App Store Connect review credentials — do not commit passwords to git)

Free tier (no subscription required)
- Up to ${FREE_LIST_ITEMS_LIMIT} items on the grocery list
- Up to ${FREE_MEALS_LIMIT} planned meal
- Up to ${FREE_RECIPES_LIMIT} saved recipe
- Basic list add and local categorization cache work without subscribing

Listio+ (subscription)
- Unlimited list items, meals, and recipes
- Cloud sync across devices
- AI: Smart add, recipe URL import, paste-to-import ingredients
- Subscribe via contextual paywall (e.g. add a 4th list item) or Settings → Plan
- Restore purchases: Settings → Restore purchases

Legal URLs (also set in App Store Connect metadata)
- Privacy: ${PRIVACY_POLICY_URL}
- Terms: ${TERMS_OF_USE_URL}
- Support: ${SUPPORT_HELP_CENTER_URL}
`;
