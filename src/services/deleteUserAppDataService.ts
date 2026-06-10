import { supabase, getUserId, isSyncEnabled } from './supabaseClient';
import { clearAllLocalData } from './localDataService';
import { mapDbErrorToUserMessage } from '../utils/mapDbError';
import { clearAllRecentItems } from './recentItemsStore';
import { clearCategoryCache } from './aiCategoryCache';

/**
 * Deletes all list items, meals, recipes, and store profiles for a user on Supabase.
 * Child ingredient rows are removed via FK cascades / triggers.
 */
export async function deleteUserSyncedContent(userId: string): Promise<void> {
  const steps = [
    () => supabase.from('meals').delete().eq('user_id', userId),
    () => supabase.from('recipes').delete().eq('user_id', userId),
    () => supabase.from('list_items').delete().eq('user_id', userId),
    () => supabase.from('store_profiles').delete().eq('user_id', userId),
  ];
  for (const run of steps) {
    const { error } = await run();
    if (error) throw new Error(mapDbErrorToUserMessage(error, 'Could not delete your data.'));
  }
}

/**
 * Removes grocery content (lists, planner meals, recipes, stores) while keeping the account profile
 * (email, display name, password). Does not delete `profiles` rows.
 *
 * With cloud sync: deletes the signed-in user's synced rows.
 * Always clears local AsyncStorage mirrors and recent-item history.
 */
export async function deleteAllAppDataPreservingAccount(): Promise<void> {
  await clearAllRecentItems();
  await clearCategoryCache();
  if (!isSyncEnabled()) {
    await clearAllLocalData();
    return;
  }
  const userId = await getUserId();
  if (!userId) throw new Error('Not signed in');
  await deleteUserSyncedContent(userId);
  await clearAllLocalData();
}
