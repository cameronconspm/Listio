import { DEFAULT_ZONE_ORDER } from '../data/zone';
import type { ZoneKey } from '../types/models';

const VALID = new Set<ZoneKey>(DEFAULT_ZONE_ORDER);

/** Normalize user-persisted zone order: valid keys, deduped, missing zones appended in default order. */
export function normalizePersistedZoneOrder(raw: unknown): ZoneKey[] | null {
  if (!Array.isArray(raw)) return null;
  const picked = raw.filter((k): k is ZoneKey => typeof k === 'string' && VALID.has(k as ZoneKey));
  if (picked.length === 0) return null;
  const seen = new Set<ZoneKey>();
  const deduped: ZoneKey[] = [];
  for (const k of picked) {
    if (!seen.has(k)) {
      seen.add(k);
      deduped.push(k);
    }
  }
  for (const k of DEFAULT_ZONE_ORDER) {
    if (!seen.has(k)) deduped.push(k);
  }
  return deduped;
}
