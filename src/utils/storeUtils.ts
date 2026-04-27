import type { StoreProfile, AisleEntry, ZoneKey } from '../types/models';
import { ZONE_KEYS, ZONE_ICONS } from '../data/zone';
import { haversineDistanceM } from './geo';
import { normalizeForGroceryNameMatch } from './groceryPlaceClassification';

/** Treat saved rows as the same store for list UI when names match and coords are this close. */
const STORE_DISPLAY_DEDUPE_MAX_M = 250;

/** Map of zoneKey -> custom emoji. Used when entry has icon override. */
export type ZoneIconOverrides = Partial<Record<ZoneKey, string>>;

/** Build section icon overrides from store's aisle_order (builtin entries with icon). */
export function getZoneIconOverrides(store: StoreProfile | null): ZoneIconOverrides {
  if (!store?.aisle_order) return {};
  const overrides: ZoneIconOverrides = {};
  for (const entry of store.aisle_order) {
    if (entry.type === 'builtin' && entry.icon && typeof entry.icon === 'string') {
      overrides[entry.key] = entry.icon;
    }
  }
  return overrides;
}

const DEFAULT_ICON = 'ellipsis-horizontal';

export type ZoneIconResult =
  | { type: 'emoji'; value: string }
  | { type: 'icon'; value: string };

/** Get display icon for a section: override emoji or default Ionicons key. */
export function getZoneDisplayIcon(zoneKey: ZoneKey, overrides?: ZoneIconOverrides | null): ZoneIconResult {
  const emoji = overrides?.[zoneKey];
  if (emoji && typeof emoji === 'string') return { type: 'emoji', value: emoji };
  const iconName = ZONE_ICONS[zoneKey];
  return { type: 'icon', value: typeof iconName === 'string' ? iconName : DEFAULT_ICON };
}

/** Returns full section order (built-in + custom) for List tab. */
export function getAisleOrderFromStore(store: StoreProfile | null): AisleEntry[] {
  if (!store) return ZONE_KEYS.map((k) => ({ type: 'builtin' as const, key: k }));
  if (store.aisle_order && store.aisle_order.length > 0) return store.aisle_order;
  return (store.zone_order?.length ? store.zone_order : ZONE_KEYS).map((k) => ({
    type: 'builtin' as const,
    key: k,
  }));
}

/** Returns ordered ZoneKeys for List tab (built-in sections only). */
export function getZoneOrderFromStore(store: StoreProfile | null): ZoneKey[] {
  if (!store) return [...ZONE_KEYS];
  if (store.aisle_order && store.aisle_order.length > 0) {
    return store.aisle_order
      .filter((e): e is AisleEntry & { type: 'builtin' } => e.type === 'builtin')
      .map((e) => e.key);
  }
  return store.zone_order?.length ? store.zone_order : [...ZONE_KEYS];
}

/** Returns total section count (built-in + custom) for display. */
export function getAisleCount(store: StoreProfile | null): number {
  if (!store) return 0;
  if (store.aisle_order && store.aisle_order.length > 0) {
    return store.aisle_order.length;
  }
  return store.zone_order?.length ?? 0;
}

/** Converts zone_order (legacy) to aisle_order format (section rows). */
export function zoneOrderToAisleOrder(zoneOrder: ZoneKey[]): AisleEntry[] {
  return zoneOrder.map((key) => ({ type: 'builtin' as const, key }));
}

/** Prefer default, then Google-linked row, then older created_at (keeps canonical row for dedupe). */
function compareStoreKeepPreference(a: StoreProfile, b: StoreProfile): number {
  if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
  const pa = Boolean(a.place_id && a.place_id.length > 0);
  const pb = Boolean(b.place_id && b.place_id.length > 0);
  if (pa !== pb) return pa ? -1 : 1;
  const ta = a.created_at ? Date.parse(a.created_at) : 0;
  const tb = b.created_at ? Date.parse(b.created_at) : 0;
  return ta - tb;
}

function storesAreDisplayDuplicates(a: StoreProfile, b: StoreProfile): boolean {
  if (a.place_id && b.place_id && a.place_id === b.place_id) return true;
  const na = normalizeForGroceryNameMatch(a.name);
  const nb = normalizeForGroceryNameMatch(b.name);
  if (!na || !nb || na !== nb) return false;
  const latA = a.latitude;
  const lngA = a.longitude;
  const latB = b.latitude;
  const lngB = b.longitude;
  if (
    latA == null ||
    lngA == null ||
    latB == null ||
    lngB == null ||
    Number.isNaN(latA) ||
    Number.isNaN(lngA) ||
    Number.isNaN(latB) ||
    Number.isNaN(lngB)
  ) {
    return false;
  }
  return haversineDistanceM(latA, lngA, latB, lngB) <= STORE_DISPLAY_DEDUPE_MAX_M;
}

/**
 * Collapses duplicate household stores in pickers (same Google place_id, or same normalized name
 * within ~250m). Prefers default, then place-linked rows, then older created_at.
 */
export function dedupeStoresForDisplay(stores: StoreProfile[]): StoreProfile[] {
  if (stores.length <= 1) return stores;
  const sorted = [...stores].sort(compareStoreKeepPreference);
  const kept: StoreProfile[] = [];
  for (const s of sorted) {
    if (kept.some((k) => storesAreDisplayDuplicates(k, s))) continue;
    kept.push(s);
  }
  kept.sort((a, b) => {
    if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
    const ta = a.created_at ? Date.parse(a.created_at) : 0;
    const tb = b.created_at ? Date.parse(b.created_at) : 0;
    return ta - tb;
  });
  return kept;
}
