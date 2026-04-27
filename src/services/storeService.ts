import { supabase, isSyncEnabled } from './supabaseClient';
import { getCurrentHouseholdId } from './householdService';
import * as local from './localDataService';
import type { StoreProfile, AisleEntry, StoreType, ZoneKey } from '../types/models';
import { ZONE_KEYS } from '../data/zone';
import { zoneOrderToAisleOrder } from '../utils/storeUtils';
import { mapDbErrorToUserMessage } from '../utils/mapDbError';
import { sanitizeCreateStore, sanitizeUpdateStore } from '../utils/sanitizeUserText';

const DEFAULT_ZONE_ORDER: ZoneKey[] = [...ZONE_KEYS];

/** No-op for sync: default `store_profiles` rows are not auto-created from the client. */
export async function ensureDefaultStore(_userId: string): Promise<void> {
  if (!isSyncEnabled()) return local.ensureDefaultStore(_userId);
  /* no-op */
}

/**
 * Returns the default store for the user, or null.
 */
export async function getDefaultStore(userId: string): Promise<StoreProfile | null> {
  if (!isSyncEnabled()) return local.getDefaultStore(userId);
  const householdId = await getCurrentHouseholdId();
  const { data, error } = await supabase
    .from('store_profiles')
    .select('*')
    .eq('household_id', householdId)
    .eq('is_default', true)
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data);
}

/**
 * Creates a new store for the user.
 */
export type CreateStoreInput = {
  name: string;
  store_type?: StoreType;
  zone_order?: ZoneKey[];
  aisle_order?: AisleEntry[];
  notes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_address?: string | null;
  place_id?: string | null;
  place_provider?: 'google' | null;
};

export async function createStore(userId: string, data: CreateStoreInput): Promise<StoreProfile> {
  if (!isSyncEnabled()) return local.createStore(userId, data);
  const d = sanitizeCreateStore(data);
  const householdId = await getCurrentHouseholdId();
  const existing = await getStores(userId);
  const makeDefault = existing.length === 0;
  const aisleOrder = d.aisle_order ?? (d.zone_order ? zoneOrderToAisleOrder(d.zone_order) : zoneOrderToAisleOrder(DEFAULT_ZONE_ORDER));
  const zoneOrder = d.zone_order ?? aisleOrder.filter((e) => e.type === 'builtin').map((e) => e.key);

  /** Core columns present after household migrations; omit `aisle_order` so older DBs without migration 008 still accept inserts. */
  const basePayload: Record<string, unknown> = {
    user_id: userId,
    household_id: householdId,
    name: d.name,
    store_type: d.store_type ?? 'generic',
    zone_order: zoneOrder,
    is_default: makeDefault,
  };

  const extendedPayload: Record<string, unknown> = { ...basePayload };
  if (d.notes != null) extendedPayload.notes = d.notes;
  if (d.latitude !== undefined) extendedPayload.latitude = d.latitude;
  if (d.longitude !== undefined) extendedPayload.longitude = d.longitude;
  if (d.location_address !== undefined) extendedPayload.location_address = d.location_address;
  if (d.place_id !== undefined) extendedPayload.place_id = d.place_id;
  if (d.place_provider !== undefined) extendedPayload.place_provider = d.place_provider;

  let attempt = await supabase.from('store_profiles').insert(extendedPayload).select().single();
  if (attempt.error?.code === 'PGRST204') {
    attempt = await supabase.from('store_profiles').insert(basePayload).select().single();
  }

  if (attempt.error) throw new Error(mapDbErrorToUserMessage(attempt.error, 'Could not create store.'));
  return mapRow(attempt.data as Record<string, unknown>);
}

/**
 * Returns all stores for the user.
 */
export async function getStores(userId: string): Promise<StoreProfile[]> {
  if (!isSyncEnabled()) return local.getStores(userId);
  const householdId = await getCurrentHouseholdId();
  const { data, error } = await supabase
    .from('store_profiles')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true });

  if (error) return [];
  return (data ?? []).map(mapRow);
}

/**
 * Sets the default store for the user. Clears is_default on all others.
 */
export async function setDefaultStore(userId: string, storeId: string): Promise<void> {
  if (!isSyncEnabled()) return local.setDefaultStore(userId, storeId);
  const householdId = await getCurrentHouseholdId();
  await supabase.from('store_profiles').update({ is_default: false }).eq('household_id', householdId);

  await supabase
    .from('store_profiles')
    .update({ is_default: true })
    .eq('id', storeId)
    .eq('household_id', householdId);
}

/**
 * Updates a store profile.
 */
export type UpdateStoreProfileInput = {
  store_type?: StoreType;
  zone_order?: ZoneKey[];
  aisle_order?: AisleEntry[];
  /** Only set when re-linking to a maps place (with name + coords from POI). */
  name?: string;
  notes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_address?: string | null;
  place_id?: string | null;
  place_provider?: 'google' | null;
};

export async function updateStoreProfile(storeId: string, updates: UpdateStoreProfileInput): Promise<void> {
  if (!isSyncEnabled()) return local.updateStoreProfile(storeId, updates);
  const safe = sanitizeUpdateStore(updates);
  const payload: Record<string, unknown> = {};
  if (safe.store_type != null) payload.store_type = safe.store_type;
  if (safe.zone_order != null) {
    payload.zone_order = safe.zone_order;
    payload.aisle_order = zoneOrderToAisleOrder(safe.zone_order);
  }
  if (safe.aisle_order != null) {
    payload.aisle_order = safe.aisle_order;
    payload.zone_order = safe.aisle_order
      .filter((e): e is AisleEntry & { type: 'builtin' } => e.type === 'builtin')
      .map((e) => e.key);
  }
  if (safe.name != null) payload.name = safe.name;
  if (safe.notes !== undefined) payload.notes = safe.notes;
  if (safe.latitude !== undefined) payload.latitude = safe.latitude;
  if (safe.longitude !== undefined) payload.longitude = safe.longitude;
  if (safe.location_address !== undefined) payload.location_address = safe.location_address;
  if (safe.place_id !== undefined) payload.place_id = safe.place_id;
  if (safe.place_provider !== undefined) payload.place_provider = safe.place_provider;
  if (Object.keys(payload).length === 0) return;

  await supabase.from('store_profiles').update(payload).eq('id', storeId);
}

/**
 * Deletes a store. If it was the default, sets the first remaining store as default.
 */
export async function deleteStore(userId: string, storeId: string): Promise<void> {
  if (!isSyncEnabled()) return local.deleteStore(userId, storeId);
  const stores = await getStores(userId);
  const store = stores.find((s) => s.id === storeId);
  if (!store) return;

  const { error: deleteError } = await supabase.from('store_profiles').delete().eq('id', storeId);
  if (deleteError) throw new Error(mapDbErrorToUserMessage(deleteError, 'Could not delete store.'));

  if (store.is_default && stores.length > 1) {
    const next = stores.find((s) => s.id !== storeId);
    if (next) await setDefaultStore(userId, next.id);
  }
}

function mapRow(row: Record<string, unknown>): StoreProfile {
  const zoneOrder = (row.zone_order as ZoneKey[]) ?? DEFAULT_ZONE_ORDER;
  const aisleOrder = row.aisle_order as AisleEntry[] | undefined;
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    household_id: row.household_id as string | undefined,
    name: row.name as string,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    location_address: (row.location_address as string | null) ?? null,
    place_id: (row.place_id as string | null | undefined) ?? null,
    place_provider: (row.place_provider as 'google' | null | undefined) ?? null,
    store_type: row.store_type as StoreType,
    zone_order: zoneOrder,
    aisle_order: aisleOrder && Array.isArray(aisleOrder) ? aisleOrder : undefined,
    notes: (row.notes as string | null) ?? undefined,
    is_default: Boolean(row.is_default),
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
  };
}
