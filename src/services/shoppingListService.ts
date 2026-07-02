import { supabase, isSyncEnabled } from './supabaseClient';
import { LOCAL_SYNC_SCOPE_ID } from '../constants/localSyncScope';
import { mapDbErrorToUserMessage } from '../utils/mapDbError';
import { resolveDataScopeId } from './syncInsertScope';
import { fetchUserPreferences, patchUserPreferencesIfSync } from './userPreferencesService';
import type { ShoppingList } from '../types/models';

let listIdInflight: Promise<string> | null = null;
let listIdInflightScope: string | null = null;
let listIdResolved: { scopeId: string; value: string } | null = null;
let listResolutionGeneration = 0;

export function invalidateDefaultListIdCache(scopeId?: string | null): void {
  listResolutionGeneration += 1;
  listIdInflight = null;
  listIdInflightScope = null;
  if (!scopeId) {
    listIdResolved = null;
    return;
  }
  if (listIdResolved?.scopeId !== scopeId) {
    listIdResolved = null;
  }
}

/** Pre-warm default list resolution on sign-in. */
export function primeDefaultListId(uid: string | null | undefined): void {
  if (!isSyncEnabled()) return;
  if (!uid) {
    invalidateDefaultListIdCache(null);
    return;
  }
  void resolveDefaultListId().catch(() => undefined);
}

async function fetchOrCreateDefaultListRow(scopeId: string): Promise<string> {
  const { data: defaultList, error: defaultError } = await supabase
    .from('shopping_lists')
    .select('id')
    .eq('household_id', scopeId)
    .eq('is_default', true)
    .maybeSingle();

  if (defaultError) {
    throw new Error(mapDbErrorToUserMessage(defaultError, 'Could not load your list.'));
  }
  if (defaultList?.id) return String(defaultList.id);

  const { data: anyList, error: anyError } = await supabase
    .from('shopping_lists')
    .select('id')
    .eq('household_id', scopeId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (anyError) {
    throw new Error(mapDbErrorToUserMessage(anyError, 'Could not load your list.'));
  }
  if (anyList?.id) return String(anyList.id);

  const { data: created, error: insertError } = await supabase
    .from('shopping_lists')
    .insert({
      household_id: scopeId,
      name: 'Groceries',
      is_default: true,
      sort_order: 0,
    })
    .select('id')
    .single();

  if (insertError) {
    throw new Error(mapDbErrorToUserMessage(insertError, 'Could not load your list.'));
  }
  return String(created.id);
}

/**
 * Active shopping list id for inserts/fetches (user-selected or default).
 */
export async function resolveActiveListId(): Promise<string> {
  if (!isSyncEnabled()) return LOCAL_SYNC_SCOPE_ID;

  const scopeId = await resolveDataScopeId();
  if (listIdResolved?.scopeId === scopeId) return listIdResolved.value;
  if (listIdInflight && listIdInflightScope === scopeId) return listIdInflight;

  const generation = listResolutionGeneration;
  listIdInflightScope = scopeId;
  listIdInflight = resolveActiveListRow(scopeId)
    .then((value) => {
      if (generation === listResolutionGeneration) {
        listIdResolved = { scopeId, value };
      }
      return value;
    })
    .finally(() => {
      if (generation === listResolutionGeneration) {
        listIdInflight = null;
        listIdInflightScope = null;
      }
    });

  return listIdInflight;
}

/** @deprecated Use resolveActiveListId — kept for call-site compatibility. */
export async function resolveDefaultListId(): Promise<string> {
  return resolveActiveListId();
}

async function resolveActiveListRow(scopeId: string): Promise<string> {
  const prefs = await fetchUserPreferences();
  const preferredId = prefs.listUi?.activeListId;
  if (preferredId) {
    const { data, error } = await supabase
      .from('shopping_lists')
      .select('id')
      .eq('id', preferredId)
      .eq('household_id', scopeId)
      .maybeSingle();
    if (!error && data?.id) return String(data.id);
  }
  return fetchOrCreateDefaultListRow(scopeId);
}

export async function fetchShoppingLists(): Promise<ShoppingList[]> {
  if (!isSyncEnabled()) return [];
  const scopeId = await resolveDataScopeId();
  const { data, error } = await supabase
    .from('shopping_lists')
    .select('id, household_id, name, is_default, sort_order, created_at, updated_at')
    .eq('household_id', scopeId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(mapDbErrorToUserMessage(error, 'Could not load lists.'));
  }
  return (data ?? []) as ShoppingList[];
}

export async function createShoppingList(name: string): Promise<ShoppingList> {
  if (!isSyncEnabled()) throw new Error('Sign in to create lists.');
  const scopeId = await resolveDataScopeId();
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Enter a list name.');

  const { data: existing, error: countError } = await supabase
    .from('shopping_lists')
    .select('sort_order')
    .eq('household_id', scopeId)
    .order('sort_order', { ascending: false })
    .limit(1);

  if (countError) {
    throw new Error(mapDbErrorToUserMessage(countError, 'Could not create list.'));
  }

  const nextSort = ((existing?.[0]?.sort_order as number | undefined) ?? 0) + 1;

  const { data, error } = await supabase
    .from('shopping_lists')
    .insert({
      household_id: scopeId,
      name: trimmed,
      is_default: false,
      sort_order: nextSort,
    })
    .select('id, household_id, name, is_default, sort_order, created_at, updated_at')
    .single();

  if (error) {
    throw new Error(mapDbErrorToUserMessage(error, 'Could not create list.'));
  }
  return data as ShoppingList;
}

export async function setActiveShoppingListId(listId: string): Promise<void> {
  await patchUserPreferencesIfSync({ listUi: { activeListId: listId } });
  invalidateDefaultListIdCache();
}

export async function renameShoppingList(listId: string, name: string): Promise<ShoppingList> {
  if (!isSyncEnabled()) throw new Error('Sign in to rename lists.');
  const scopeId = await resolveDataScopeId();
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Enter a list name.');

  const { data, error } = await supabase
    .from('shopping_lists')
    .update({ name: trimmed })
    .eq('id', listId)
    .eq('household_id', scopeId)
    .select('id, household_id, name, is_default, sort_order, created_at, updated_at')
    .single();

  if (error) {
    throw new Error(mapDbErrorToUserMessage(error, 'Could not rename list.'));
  }
  return data as ShoppingList;
}

export async function deleteShoppingList(listId: string): Promise<void> {
  if (!isSyncEnabled()) throw new Error('Sign in to delete lists.');
  const scopeId = await resolveDataScopeId();
  const lists = await fetchShoppingLists();
  if (lists.length <= 1) {
    throw new Error('You need at least one list.');
  }
  const target = lists.find((list) => list.id === listId);
  if (!target) {
    throw new Error('List not found.');
  }
  if (target.is_default) {
    throw new Error('Your main list cannot be deleted.');
  }

  const { error } = await supabase
    .from('shopping_lists')
    .delete()
    .eq('id', listId)
    .eq('household_id', scopeId);

  if (error) {
    throw new Error(mapDbErrorToUserMessage(error, 'Could not delete list.'));
  }
  invalidateDefaultListIdCache();
}
