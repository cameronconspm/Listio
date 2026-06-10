import { supabase, isSyncEnabled } from './supabaseClient';
import { LOCAL_SYNC_SCOPE_ID } from '../constants/localSyncScope';
import { mapDbErrorToUserMessage } from '../utils/mapDbError';
import { resolveDataScopeId } from './syncInsertScope';

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
 * Active shopping list id for inserts/fetches (default list for the user).
 */
export async function resolveDefaultListId(): Promise<string> {
  if (!isSyncEnabled()) return LOCAL_SYNC_SCOPE_ID;

  const scopeId = await resolveDataScopeId();
  if (listIdResolved?.scopeId === scopeId) return listIdResolved.value;
  if (listIdInflight && listIdInflightScope === scopeId) return listIdInflight;

  const generation = listResolutionGeneration;
  listIdInflightScope = scopeId;
  listIdInflight = fetchOrCreateDefaultListRow(scopeId)
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
