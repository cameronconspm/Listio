import {
  allMilestonesMet,
  getMilestoneUnlockState,
  markMealMilestone,
  markRecipeMilestone,
  markUnlockPaywallPresented,
  syncListCountMilestone,
} from './milestoneUnlockStore';
import type { ListItem } from '../types/models';
import { isPendingListItemId } from '../utils/listItemPending';

/**
 * Tracks the "list 3 / meal 1 / recipe 1" milestone state. The dedicated
 * unlock paywall has been replaced by hard free-tier capacity gates (see
 * `freeTierLimits.ts`), so this function only marks the milestone state as
 * presented once met and never surfaces a paywall.
 */
export function evaluateMilestoneUnlockPaywall(): void {
  void (async () => {
    const st = await getMilestoneUnlockState();
    if (allMilestonesMet(st) && !st.unlockPaywallPresented) {
      await markUnlockPaywallPresented();
    }
  })();
}

/** List length changed — sync “3+ items” milestone and maybe show unlock paywall. */
export function notifyListItemsForMilestones(items: ListItem[]): void {
  const persistedCount = items.filter((i) => !isPendingListItemId(i.id)).length;
  void (async () => {
    await syncListCountMilestone(persistedCount);
    evaluateMilestoneUnlockPaywall();
  })();
}

export function notifyMealSavedForMilestones(): void {
  void (async () => {
    await markMealMilestone();
    evaluateMilestoneUnlockPaywall();
  })();
}

export function notifyRecipeSavedForMilestones(): void {
  void (async () => {
    await markRecipeMilestone();
    evaluateMilestoneUnlockPaywall();
  })();
}
