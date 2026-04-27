import type { ListItem, ZoneKey } from '../../types/models';
import { DEFAULT_ZONE_ORDER } from '../../data/zone';
import { toBoolean } from '../../utils/normalize';

export type HomeSectionItem = { zone: ZoneKey; items: ListItem[] };
type GroupedItems = Record<ZoneKey, ListItem[]>;

function compareByNameThenId(a: ListItem, b: ListItem): number {
  const cmp = (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
  if (cmp !== 0) return cmp;
  return a.id.localeCompare(b.id);
}

/** Within each section, sort by display name (case-insensitive), then id for stability. */
export function sortItemsInSectionAlphabetically(items: ListItem[]): ListItem[] {
  return [...items].sort(compareByNameThenId);
}

export type HomeListDerivedModel = {
  grouped: GroupedItems;
  zoneCounts: Record<ZoneKey, number>;
  remaining: number;
  zoneRemaining: Record<ZoneKey, number>;
  sectionsLeft: number;
  currentSection: ZoneKey | null;
  nextSectionForSummary: ZoneKey | null;
  isFiltered: boolean;
  filteredItems: ListItem[];
  filteredRemaining: number;
  filteredZoneCount: number;
  filteredSectionsLeft: number;
  rawSections: HomeSectionItem[];
  orderedSections: HomeSectionItem[];
  sections: HomeSectionItem[];
};

/**
 * Pure list/section derivations for the home list tab (Plan/Shop).
 * Items within each section are ordered alphabetically by display name.
 */
export function deriveHomeListModel(
  safeItems: ListItem[],
  effectiveZoneOrder: ZoneKey[],
  shoppingMode: 'plan' | 'shop',
  filterZone: ZoneKey | 'all'
): HomeListDerivedModel {
  const grouped = Object.create(null) as GroupedItems;
  const zoneCounts = Object.create(null) as Record<ZoneKey, number>;
  const zoneRemaining = Object.create(null) as Record<ZoneKey, number>;
  for (const z of effectiveZoneOrder) {
    grouped[z] = [];
    zoneCounts[z] = 0;
    zoneRemaining[z] = 0;
  }

  let checkedCount = 0;
  let filteredCheckedCount = 0;
  let filteredTotal = 0;
  const isFiltered = filterZone !== 'all';

  for (const it of safeItems) {
    const bucket = grouped[it.zone_key];
    if (!bucket) continue;
    bucket.push(it);
    zoneCounts[it.zone_key]++;
    const checked = toBoolean(it.is_checked);
    if (checked) checkedCount++;
    else zoneRemaining[it.zone_key]++;
    if (isFiltered && it.zone_key === filterZone) {
      filteredTotal++;
      if (checked) filteredCheckedCount++;
    }
  }

  for (const z of effectiveZoneOrder) {
    if (grouped[z].length > 1) grouped[z].sort(compareByNameThenId);
  }

  const remaining = safeItems.length - checkedCount;

  let sectionsLeft = 0;
  let currentSection: ZoneKey | null = null;
  let populatedZones = 0;
  for (const z of effectiveZoneOrder) {
    if (zoneCounts[z] > 0) populatedZones++;
    if (zoneRemaining[z] > 0) {
      sectionsLeft++;
      if (currentSection === null) currentSection = z;
    }
  }
  const nextSectionForSummary: ZoneKey | null = currentSection;

  const filteredItems = isFiltered ? (grouped[filterZone] ?? []) : safeItems;
  const filteredRemaining = isFiltered ? filteredTotal - filteredCheckedCount : remaining;
  const filteredZoneCount = isFiltered
    ? filteredItems.length > 0
      ? 1
      : 0
    : populatedZones;
  const filteredSectionsLeft = isFiltered ? (filteredRemaining > 0 ? 1 : 0) : sectionsLeft;

  const rawSections: HomeSectionItem[] = [];
  for (const zone of effectiveZoneOrder) {
    const bucket = grouped[zone];
    if (bucket.length > 0) rawSections.push({ zone, items: bucket });
  }

  let orderedSections: HomeSectionItem[];
  if (shoppingMode === 'shop') {
    orderedSections = [];
    const done: HomeSectionItem[] = [];
    for (const s of rawSections) {
      if ((zoneRemaining[s.zone] ?? 0) > 0) orderedSections.push(s);
      else done.push(s);
    }
    if (done.length > 0) orderedSections = orderedSections.concat(done);
  } else {
    orderedSections = rawSections;
  }

  const sections: HomeSectionItem[] = isFiltered
    ? orderedSections.filter((s) => s.zone === filterZone)
    : orderedSections;

  return {
    grouped,
    zoneCounts,
    remaining,
    zoneRemaining,
    sectionsLeft,
    currentSection,
    nextSectionForSummary,
    isFiltered,
    filteredItems,
    filteredRemaining,
    filteredZoneCount,
    filteredSectionsLeft,
    rawSections,
    orderedSections,
    sections,
  };
}

export function safeZoneOrderOrDefault(zoneOrder: ZoneKey[] | null | undefined): ZoneKey[] {
  return zoneOrder ?? DEFAULT_ZONE_ORDER;
}
