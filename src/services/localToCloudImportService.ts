import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, LOCAL_USER_ID } from './supabaseClient';
import { getCurrentHouseholdId } from './householdService';
import { clearAllLocalData, snapshotLocalDataForUser } from './localDataService';
import { mapDbErrorToUserMessage } from '../utils/mapDbError';
import {
  sanitizeCreateStore,
  sanitizeListItemInsert,
  sanitizeMealCreate,
  sanitizeMealIngredientInput,
  sanitizeRecipeCreate,
  sanitizeRecipeIngredientInput,
} from '../utils/sanitizeUserText';

const IMPORT_STATE_PREFIX = '@listio/local-to-cloud-state:';

type ImportState = 'no-local' | 'imported' | 'skipped-remote-not-empty';

function importStateKey(userId: string): string {
  return `${IMPORT_STATE_PREFIX}${userId}`;
}

async function getImportState(userId: string): Promise<ImportState | null> {
  const v = await AsyncStorage.getItem(importStateKey(userId));
  if (v === 'no-local' || v === 'imported' || v === 'skipped-remote-not-empty') return v;
  return null;
}

async function setImportState(userId: string, state: ImportState): Promise<void> {
  await AsyncStorage.setItem(importStateKey(userId), state);
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

export async function isRemoteHouseholdEmpty(): Promise<boolean> {
  const householdId = await getCurrentHouseholdId();
  const tables = ['store_profiles', 'list_items', 'recipes', 'meals'] as const;
  for (const t of tables) {
    const { count, error } = await supabase
      .from(t)
      .select('*', { count: 'exact', head: true })
      .eq('household_id', householdId);
    if (error) return false;
    if ((count ?? 0) > 0) return false;
  }
  return true;
}

function hasSnapshotData(snap: Awaited<ReturnType<typeof snapshotLocalDataForUser>>): boolean {
  return (
    snap.listItems.length > 0 ||
    snap.meals.length > 0 ||
    snap.recipes.length > 0 ||
    snap.storeProfiles.length > 0
  );
}

async function importLocalSnapshotToCloud(
  userId: string,
  snap: Awaited<ReturnType<typeof snapshotLocalDataForUser>>
): Promise<void> {
  const batchSize = 40;
  const householdId = await getCurrentHouseholdId();

  if (snap.storeProfiles.length > 0) {
    const rows = snap.storeProfiles.map((s) => {
      const t = sanitizeCreateStore({
        name: s.name,
        store_type: s.store_type,
        zone_order: s.zone_order,
        aisle_order: s.aisle_order ?? undefined,
        notes: s.notes ?? null,
        latitude: s.latitude ?? null,
        longitude: s.longitude ?? null,
        location_address: s.location_address ?? null,
        place_id: s.place_id ?? null,
        place_provider: s.place_provider ?? null,
      });
      return {
      id: s.id,
      user_id: userId,
      household_id: householdId,
      name: t.name,
      store_type: t.store_type,
      zone_order: s.zone_order,
      aisle_order: s.aisle_order ?? null,
      notes: t.notes ?? null,
      latitude: t.latitude ?? null,
      longitude: t.longitude ?? null,
      location_address: t.location_address ?? null,
      place_id: t.place_id ?? null,
      place_provider: t.place_provider ?? null,
      is_default: s.is_default,
      created_at: s.created_at ?? new Date().toISOString(),
      updated_at: s.updated_at ?? new Date().toISOString(),
    };
    });
    for (const batch of chunkArray(rows, batchSize)) {
      const { error } = await supabase.from('store_profiles').insert(batch);
      if (error) throw new Error(mapDbErrorToUserMessage(error, 'Import failed.'));
    }
  }

  if (snap.recipes.length > 0) {
    const rows = snap.recipes.map((r) => {
      const t = sanitizeRecipeCreate({
        name: r.name,
        servings: r.servings ?? 4,
        category: r.category ?? null,
        recipe_url: r.recipe_url ?? null,
        notes: r.notes ?? null,
      });
      return {
      id: r.id,
      user_id: userId,
      household_id: householdId,
      name: t.name,
      servings: t.servings ?? 4,
      recipe_url: t.recipe_url ?? null,
      notes: t.notes ?? null,
      is_favorite: r.is_favorite ?? false,
      category: t.category ?? null,
      last_used_at: r.last_used_at ?? null,
      created_at: r.created_at ?? new Date().toISOString(),
      updated_at: r.updated_at ?? new Date().toISOString(),
    };
    });
    for (const batch of chunkArray(rows, batchSize)) {
      const { error } = await supabase.from('recipes').insert(batch);
      if (error) throw new Error(mapDbErrorToUserMessage(error, 'Import failed.'));
    }
  }

  if (snap.recipeIngredients.length > 0) {
    const rows = snap.recipeIngredients.map((row) => {
      const i = sanitizeRecipeIngredientInput({
        name: row.name,
        quantity_value: row.quantity_value,
        quantity_unit: row.quantity_unit,
        notes: row.notes ?? null,
      });
      return {
      id: row.id,
      recipe_id: row.recipe_id,
      name: i.name,
      quantity_value: i.quantity_value,
      quantity_unit: i.quantity_unit,
      notes: i.notes ?? null,
    };
    });
    for (const batch of chunkArray(rows, batchSize)) {
      const { error } = await supabase.from('recipe_ingredients').insert(batch);
      if (error) throw new Error(mapDbErrorToUserMessage(error, 'Import failed.'));
    }
  }

  if (snap.meals.length > 0) {
    const rows = snap.meals.map((m) => {
      const t = sanitizeMealCreate({
        name: m.name,
        meal_date: m.meal_date,
        meal_slot: m.meal_slot,
        custom_slot_name: m.custom_slot_name,
        recipe_id: m.recipe_id,
        recipe_url: m.recipe_url,
        notes: m.notes,
      });
      return {
      id: m.id,
      user_id: userId,
      household_id: householdId,
      name: t.name,
      recipe_id: t.recipe_id ?? m.recipe_id,
      start_date: m.start_date,
      end_date: m.end_date,
      meal_date: t.meal_date,
      meal_slot: t.meal_slot,
      custom_slot_name: t.custom_slot_name ?? m.custom_slot_name,
      recipe_url: t.recipe_url ?? null,
      notes: t.notes ?? null,
      created_at: m.created_at ?? new Date().toISOString(),
      updated_at: m.updated_at ?? new Date().toISOString(),
    };
    });
    for (const batch of chunkArray(rows, batchSize)) {
      const { error } = await supabase.from('meals').insert(batch);
      if (error) throw new Error(mapDbErrorToUserMessage(error, 'Import failed.'));
    }
  }

  if (snap.mealIngredients.length > 0) {
    const rows = snap.mealIngredients.map((row) => {
      const i = sanitizeMealIngredientInput({
        name: row.name,
        normalized_name: row.normalized_name,
        quantity_value: row.quantity_value,
        quantity_unit: row.quantity_unit,
        notes: row.notes ?? null,
        brand_preference: row.brand_preference ?? null,
      });
      return {
      id: row.id,
      meal_id: row.meal_id,
      name: i.name,
      normalized_name: i.normalized_name ?? row.normalized_name,
      quantity_value: i.quantity_value,
      quantity_unit: i.quantity_unit,
      notes: i.notes ?? null,
      brand_preference: i.brand_preference ?? null,
    };
    });
    for (const batch of chunkArray(rows, batchSize)) {
      const { error } = await supabase.from('meal_ingredients').insert(batch);
      if (error) throw new Error(mapDbErrorToUserMessage(error, 'Import failed.'));
    }
  }

  if (snap.listItems.length > 0) {
    const rows = snap.listItems.map((item) => {
      const s = sanitizeListItemInsert({
        user_id: userId,
        name: item.name,
        normalized_name: item.normalized_name,
        category: item.category,
        zone_key: item.zone_key,
        quantity_value: item.quantity_value,
        quantity_unit: item.quantity_unit,
        notes: item.notes,
        is_checked: item.is_checked,
        linked_meal_ids: item.linked_meal_ids ?? [],
        brand_preference: item.brand_preference ?? null,
        substitute_allowed: item.substitute_allowed ?? true,
        priority: item.priority ?? 'normal',
        is_recurring: item.is_recurring ?? false,
      });
      return {
      id: item.id,
      user_id: userId,
      household_id: householdId,
      name: s.name,
      normalized_name: s.normalized_name,
      category: s.category,
      zone_key: s.zone_key,
      quantity_value: s.quantity_value,
      quantity_unit: s.quantity_unit,
      notes: s.notes,
      is_checked: s.is_checked,
      linked_meal_ids: s.linked_meal_ids ?? [],
      brand_preference: s.brand_preference ?? null,
      substitute_allowed: s.substitute_allowed ?? true,
      priority: s.priority ?? 'normal',
      is_recurring: s.is_recurring ?? false,
      created_at: item.created_at,
      updated_at: item.updated_at,
    };
    });
    for (const batch of chunkArray(rows, batchSize)) {
      const { error } = await supabase.from('list_items').insert(batch);
      if (error) throw new Error(mapDbErrorToUserMessage(error, 'Import failed.'));
    }
  }
}

/**
 * After sign-in: if this device has local-only data for {@link LOCAL_USER_ID} and the account
 * has no remote rows yet, import then clear local entity storage.
 */
export async function maybeImportLocalDataOnSignIn(userId: string): Promise<void> {
  const state = await getImportState(userId);
  if (state) return;

  const snap = await snapshotLocalDataForUser(LOCAL_USER_ID);
  if (!hasSnapshotData(snap)) {
    await setImportState(userId, 'no-local');
    return;
  }

  const empty = await isRemoteHouseholdEmpty();
  if (!empty) {
    await setImportState(userId, 'skipped-remote-not-empty');
    return;
  }

  try {
    await importLocalSnapshotToCloud(userId, snap);
    await clearAllLocalData();
    await setImportState(userId, 'imported');
  } catch {
    // Leave state unset so the next session can retry.
  }
}

export type ManualImportResult =
  | { ok: true }
  | { ok: false; reason: 'no-local' | 'remote-not-empty' | 'error'; message?: string };

/** Settings-driven import: only when the signed-in account has no synced data yet. */
export async function tryManualImportLocalDataToCloud(userId: string): Promise<ManualImportResult> {
  const snap = await snapshotLocalDataForUser(LOCAL_USER_ID);
  if (!hasSnapshotData(snap)) {
    return { ok: false, reason: 'no-local' };
  }

  const empty = await isRemoteHouseholdEmpty();
  if (!empty) {
    return { ok: false, reason: 'remote-not-empty' };
  }

  try {
    await importLocalSnapshotToCloud(userId, snap);
    await clearAllLocalData();
    await setImportState(userId, 'imported');
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: 'error',
      message: e instanceof Error ? e.message : String(e),
    };
  }
}
