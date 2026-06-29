import { supabase, isSyncEnabled } from './supabaseClient';
import * as local from './localDataService';
import type { ListItem, ItemPriority, ZoneKey } from '../types/models';
import { mapDbErrorToUserMessage } from '../utils/mapDbError';
import { logger } from '../utils/logger';
import { ServiceFetchError, throwOnSupabaseFetchError } from '../utils/serviceErrors';
import { resolveActiveListId } from './shoppingListService';
import { requireAuthenticatedUserId, resolveDataScopeId } from './syncInsertScope';
import { sanitizeListItemInsert, sanitizeListItemUpdate } from '../utils/sanitizeUserText';

export interface ListItemInsert {
  user_id: string;
  name: string;
  normalized_name: string;
  category: string;
  zone_key: ZoneKey;
  quantity_value: number | null;
  quantity_unit: string | null;
  notes: string | null;
  is_checked: boolean;
  linked_meal_ids: string[];
  brand_preference?: string | null;
  substitute_allowed?: boolean;
  priority?: ItemPriority;
  is_recurring?: boolean;
}

export async function fetchListItems(userId: string, listId?: string): Promise<ListItem[]> {
  if (!isSyncEnabled()) return local.fetchListItems(userId);
  const resolvedListId = listId ?? (await resolveActiveListId());
  const { data, error } = await supabase
    .from('list_items')
    .select('*')
    .eq('list_id', resolvedListId)
    .order('created_at', { ascending: true });

  throwOnSupabaseFetchError(error, 'Could not load your list.');
  return (data ?? []).map(mapRow);
}

export async function toggleChecked(id: string, is_checked: boolean): Promise<void> {
  if (!isSyncEnabled()) return local.toggleChecked(id, is_checked);
  await supabase.from('list_items').update({ is_checked }).eq('id', id);
}

export async function deleteListItem(id: string): Promise<void> {
  if (!isSyncEnabled()) return local.deleteListItem(id);
  await supabase.from('list_items').delete().eq('id', id);
}

export async function deleteAllListItems(userId: string): Promise<void> {
  if (!isSyncEnabled()) return local.deleteAllListItems(userId);
  const listId = await resolveActiveListId();
  const { error } = await supabase.from('list_items').delete().eq('list_id', listId);
  if (error) throw new Error(mapDbErrorToUserMessage(error, 'Could not clear your list.'));
}

export async function deleteListItemsInZone(userId: string, zoneKey: ZoneKey): Promise<void> {
  if (!isSyncEnabled()) return local.deleteListItemsInZone(userId, zoneKey);
  const listId = await resolveActiveListId();
  const { error } = await supabase
    .from('list_items')
    .delete()
    .eq('list_id', listId)
    .eq('zone_key', zoneKey);
  if (error) throw new Error(mapDbErrorToUserMessage(error, 'Could not delete that section.'));
}

export async function checkAllZoneItems(userId: string, zoneKey: ZoneKey): Promise<void> {
  if (!isSyncEnabled()) return local.checkAllZoneItems(userId, zoneKey);
  const listId = await resolveActiveListId();
  const { error } = await supabase
    .from('list_items')
    .update({ is_checked: true })
    .eq('list_id', listId)
    .eq('zone_key', zoneKey)
    .eq('is_checked', false);
  if (error) throw new Error(mapDbErrorToUserMessage(error, 'Could not check all items.'));
}

/** Removes every checked item for the user (Shop run finished). */
export async function deleteCheckedListItems(userId: string): Promise<void> {
  if (!isSyncEnabled()) return local.deleteCheckedListItems(userId);
  const listId = await resolveActiveListId();
  const { error } = await supabase
    .from('list_items')
    .delete()
    .eq('list_id', listId)
    .eq('is_checked', true);
  if (error) throw new Error(mapDbErrorToUserMessage(error, 'Could not remove checked items.'));
}

export interface ListItemUpdate {
  name?: string;
  normalized_name?: string;
  category?: string;
  zone_key?: ZoneKey;
  quantity_value?: number | null;
  quantity_unit?: string | null;
  notes?: string | null;
  brand_preference?: string | null;
  substitute_allowed?: boolean;
  priority?: ItemPriority;
  is_recurring?: boolean;
}

const LIST_ITEM_UPDATE_KEYS = [
  'name',
  'normalized_name',
  'category',
  'zone_key',
  'quantity_value',
  'quantity_unit',
  'notes',
  'brand_preference',
  'substitute_allowed',
  'priority',
  'is_recurring',
] as const satisfies readonly (keyof ListItemUpdate)[];

export async function updateListItem(id: string, updates: ListItemUpdate): Promise<void> {
  const safe = sanitizeListItemUpdate(updates);
  if (!isSyncEnabled()) return local.updateListItem(id, safe);
  const payload: Record<string, unknown> = {};
  for (const k of LIST_ITEM_UPDATE_KEYS) {
    if (k in safe && safe[k] !== undefined) payload[k] = safe[k];
  }
  if (Object.keys(payload).length === 0) return;
  const { error } = await supabase.from('list_items').update(payload).eq('id', id);
  if (error) throw new Error(mapDbErrorToUserMessage(error, 'Could not update that item.'));
}

export async function insertListItems(userId: string, items: ListItemInsert[]): Promise<ListItem[]> {
  if (items.length === 0) return [];
  const sanitized = items.map(sanitizeListItemInsert);
  if (!isSyncEnabled()) return local.insertListItems(userId, sanitized);

  const [authUserId, scopeId, listId] = await Promise.all([
    requireAuthenticatedUserId(),
    resolveDataScopeId(),
    resolveActiveListId(),
  ]);
  const rows = sanitized.map((s) => {
    return {
    user_id: authUserId,
    household_id: scopeId,
    list_id: listId,
    name: s.name,
    normalized_name: s.normalized_name,
    category: s.category,
    zone_key: s.zone_key,
    quantity_value: s.quantity_value,
    quantity_unit: s.quantity_unit,
    notes: s.notes,
    is_checked: s.is_checked,
    linked_meal_ids: s.linked_meal_ids,
    brand_preference: s.brand_preference ?? null,
    substitute_allowed: s.substitute_allowed ?? true,
    priority: s.priority ?? 'normal',
    is_recurring: s.is_recurring ?? false,
  };
  });

  const { data, error } = await supabase.from('list_items').insert(rows).select('*');
  if (error) {
    logger.warnRelease('insertListItems failed', {
      code: error.code,
      message: error.message,
      userId: authUserId,
    });
    throw new ServiceFetchError(mapDbErrorToUserMessage(error, 'Could not add items.'), error);
  }
  return (data ?? []).map(mapRow);
}

function mapRow(row: Record<string, unknown>): ListItem {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    household_id: row.household_id as string,
    list_id: row.list_id as string,
    name: row.name as string,
    normalized_name: row.normalized_name as string,
    category: row.category as string,
    zone_key: row.zone_key as ZoneKey,
    quantity_value: row.quantity_value != null ? Number(row.quantity_value) : null,
    quantity_unit: row.quantity_unit as string | null,
    notes: row.notes as string | null,
    is_checked: Boolean(row.is_checked),
    linked_meal_ids: (row.linked_meal_ids as string[]) ?? [],
    brand_preference: (row.brand_preference as string | null) ?? null,
    substitute_allowed: row.substitute_allowed != null ? Boolean(row.substitute_allowed) : true,
    priority: (row.priority as 'low' | 'normal' | 'high') ?? 'normal',
    is_recurring: row.is_recurring != null ? Boolean(row.is_recurring) : false,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}
