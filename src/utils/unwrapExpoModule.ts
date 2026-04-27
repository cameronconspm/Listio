/**
 * Metro + CJS/ESM interop often nests API under repeated `.default` (especially in bare / dev).
 * Walk the chain until `predicate` matches.
 */
function isRecordLike(x: unknown): x is Record<string, unknown> {
  if (x === null || x === undefined) return false;
  const t = typeof x;
  return t === 'object' || t === 'function';
}

export function unwrapExpoModule(
  mod: unknown,
  predicate: (x: Record<string, unknown>) => boolean
): Record<string, unknown> | null {
  let cur: unknown = mod;
  for (let i = 0; i < 12; i++) {
    if (!isRecordLike(cur)) return null;
    const r = cur as Record<string, unknown>;
    if (predicate(r)) return r;
    const d = r.default;
    if (d !== undefined && d !== null) cur = d;
    else return null;
  }
  return null;
}

/** `import()` in bare sometimes returns a stub `{ default }` where `require()` matches push flows. */
export function resolveExpoNotificationsApi(): typeof import('expo-notifications') | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const raw = require('expo-notifications') as unknown;
    const u = unwrapExpoModule(raw, (x) => typeof x.setNotificationHandler === 'function');
    if (u) return u as typeof import('expo-notifications');
    if (isRecordLike(raw) && typeof (raw as Record<string, unknown>).setNotificationHandler === 'function') {
      return raw as typeof import('expo-notifications');
    }
    return null;
  } catch {
    return null;
  }
}

export function resolveExpoLinkingCreateURL(): ((path: string) => string) | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const raw = require('expo-linking') as unknown;
    const u = unwrapExpoModule(raw, (x) => typeof x.createURL === 'function');
    if (u && typeof u.createURL === 'function') return u.createURL as (path: string) => string;
    if (isRecordLike(raw) && typeof (raw as Record<string, unknown>).createURL === 'function') {
      return (raw as Record<string, unknown>).createURL as (path: string) => string;
    }
    return null;
  } catch {
    return null;
  }
}
