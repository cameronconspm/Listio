/**
 * Client-only list row ids used while `insertListItems` is in flight.
 * Postgres UUIDs never use this prefix, so pending rows are unambiguous.
 */
export const PENDING_LIST_ITEM_PREFIX = 'pending:' as const;

export function isPendingListItemId(id: string): boolean {
  return id.startsWith(PENDING_LIST_ITEM_PREFIX);
}

export function newPendingListItemId(): string {
  const suffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `t${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${PENDING_LIST_ITEM_PREFIX}${suffix}`;
}
