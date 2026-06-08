import {
  allMilestonesMet,
  markMealMilestone,
  markRecipeMilestone,
  markUnlockPaywallPresented,
  syncListCountMilestone,
  type MilestoneMarkResult,
} from './milestoneUnlockStore';
import { showSuccess } from '../utils/appToast';
import { appHaptics } from '../hooks/useHaptics';
import type { ListItem } from '../types/models';
import { isPendingListItemId } from '../utils/listItemPending';

/**
 * The "list 3 / first meal / first recipe" milestones used to silently flip a
 * flag and (previously) trigger a paywall. They now reward the user: each
 * first-time milestone earns a warm, un-gated celebration, and completing all
 * three earns a "you've got the hang of it" graduation moment. Effort is
 * rewarded here — monetization happens later, at the free-tier caps.
 */

type MilestoneKind = 'list' | 'meal' | 'recipe';

const MILESTONE_CELEBRATION: Record<MilestoneKind, { title: string; message: string }> = {
  list: { title: 'Your list is taking shape', message: 'Three down — nice momentum.' },
  meal: { title: 'First meal planned', message: "That's your week starting to come together." },
  recipe: { title: 'Recipe saved', message: 'Drop it onto any day whenever you cook it.' },
};

const GRADUATION_CELEBRATION = {
  title: "You've got the hang of Listio",
  message: "Plan, save, shop — you've run the whole loop. Nicely done.",
};

function celebrate(title: string, message: string): void {
  appHaptics.success();
  showSuccess(message, title);
}

/**
 * Decide the reward for a freshly-met milestone. If it completes the set, show
 * the single graduation moment instead of the per-milestone toast so the two
 * don't collide. Returns silently when nothing was newly achieved.
 */
async function rewardMilestone(kind: MilestoneKind, result: MilestoneMarkResult): Promise<void> {
  if (!result.justMet) return;
  if (allMilestonesMet(result.state) && !result.state.unlockPaywallPresented) {
    await markUnlockPaywallPresented();
    celebrate(GRADUATION_CELEBRATION.title, GRADUATION_CELEBRATION.message);
    return;
  }
  const copy = MILESTONE_CELEBRATION[kind];
  celebrate(copy.title, copy.message);
}

export async function processListItemsMilestone(items: ListItem[]): Promise<void> {
  const persistedCount = items.filter((i) => !isPendingListItemId(i.id)).length;
  const result = await syncListCountMilestone(persistedCount);
  await rewardMilestone('list', result);
}

export async function processMealSavedMilestone(): Promise<void> {
  const result = await markMealMilestone();
  await rewardMilestone('meal', result);
}

export async function processRecipeSavedMilestone(): Promise<void> {
  const result = await markRecipeMilestone();
  await rewardMilestone('recipe', result);
}

/** List length changed — sync the "3+ items" milestone and reward it once. */
export function notifyListItemsForMilestones(items: ListItem[]): void {
  void processListItemsMilestone(items);
}

export function notifyMealSavedForMilestones(): void {
  void processMealSavedMilestone();
}

export function notifyRecipeSavedForMilestones(): void {
  void processRecipeSavedMilestone();
}
