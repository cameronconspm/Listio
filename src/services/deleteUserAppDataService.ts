import { supabase, isSyncEnabled } from './supabaseClient';
import { getCurrentHouseholdId } from './householdService';
import { clearAllLocalData } from './localDataService';
import { mapDbErrorToUserMessage } from '../utils/mapDbError';
import { clearAllRecentItems } from './recentItemsStore';
import { clearCategoryCache } from './aiCategoryCache';

/**
 * Deletes all list items, meals, recipes, and store profiles for a household on Supabase.
 * Child ingredient rows are removed via FK cascades / triggers.
 */
export async function deleteHouseholdSyncedContent(householdId: string): Promise<void> {
  const steps = [
    () => supabase.from('meals').delete().eq('household_id', householdId),
    () => supabase.from('recipes').delete().eq('household_id', householdId),
    () => supabase.from('list_items').delete().eq('household_id', householdId),
    () => supabase.from('store_profiles').delete().eq('household_id', householdId),
  ];
  for (const run of steps) {
    const { error } = await run();
    if (error) throw new Error(mapDbErrorToUserMessage(error, 'Could not delete your data.'));
  }
}

/**
 * Removes grocery content (lists, planner meals, recipes, stores) while keeping the account profile
 * (email, display name, password) and household membership. Does not delete `profiles`, `households`,
 * or `household_members` rows.
 *
 * With cloud sync: deletes the **current household’s** synced rows (shared with other members).
 * Always clears local AsyncStorage mirrors and recent-item history.
 */
export async function deleteAllAppDataPreservingAccount(): Promise<void> {
  await clearAllRecentItems();
  await clearCategoryCache();
  if (!isSyncEnabled()) {
    await clearAllLocalData();
    return;
  }
  const householdId = await getCurrentHouseholdId();
  await deleteHouseholdSyncedContent(householdId);
  await clearAllLocalData();
}
