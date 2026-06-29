import type { QueryClient } from '@tanstack/react-query';
import { DEFAULT_ZONE_ORDER } from '../../data/zone';
import { getCachedShoppingListsBundle } from '../../query/shoppingListsBundle';
import type { ZoneKey } from '../../types/models';
import { normalizePersistedZoneOrder } from '../../utils/zoneOrderPrefs';

const VALID_LIST_ZONES = new Set<ZoneKey>(DEFAULT_ZONE_ORDER);

export type CachedListTabUiState = {
  filterZone: ZoneKey | 'all';
  collapsedZones: Set<ZoneKey>;
  zoneOrder: ZoneKey[];
};

/** Synchronous list-tab UI prefs from the shopping-lists bootstrap cache (no second fetch flash). */
export function readCachedListTabUiState(
  queryClient: QueryClient,
  userId: string | null | undefined
): CachedListTabUiState {
  const defaults: CachedListTabUiState = {
    filterZone: 'all',
    collapsedZones: new Set(),
    zoneOrder: DEFAULT_ZONE_ORDER,
  };
  if (typeof userId !== 'string' || !userId.length) return defaults;

  const listUi = getCachedShoppingListsBundle(queryClient, userId)?.listUi;
  if (!listUi) return defaults;

  let filterZone: ZoneKey | 'all' = defaults.filterZone;
  if (
    listUi.filterZone === 'all' ||
    (listUi.filterZone && VALID_LIST_ZONES.has(listUi.filterZone as ZoneKey))
  ) {
    filterZone = listUi.filterZone as ZoneKey | 'all';
  }

  const collapsedZones = new Set<ZoneKey>();
  if (listUi.collapsedZoneKeys?.length) {
    for (const key of listUi.collapsedZoneKeys) {
      if (VALID_LIST_ZONES.has(key as ZoneKey)) collapsedZones.add(key as ZoneKey);
    }
  }

  const zoneOrder = normalizePersistedZoneOrder(listUi.zoneOrder) ?? DEFAULT_ZONE_ORDER;

  return { filterZone, collapsedZones, zoneOrder };
}
