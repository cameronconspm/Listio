import type { User } from '@supabase/supabase-js';

/**
 * Internal QA account: matches `shouldShowQaSettingsTools` in qaSettingsTools.ts (with optional
 * EXPO_PUBLIC_ENABLE_QA_SETTINGS_TOOLS for any user on QA builds).
 */
export const OFFICIAL_LISTIO_TEST_ACCOUNT_EMAIL = 'testuser@thelistioapp.com';

/** Prefer `user.email`; fall back to provider identity data (Sign in with Apple often omits `email` after the first login). */
export function resolveAuthAccountEmail(user: User | null | undefined): string | null {
  if (!user) return null;
  if (typeof user.email === 'string' && user.email.trim().length > 0) {
    return user.email;
  }
  for (const identity of user.identities ?? []) {
    const raw = identity.identity_data;
    if (raw && typeof raw === 'object' && 'email' in raw) {
      const e = (raw as { email?: unknown }).email;
      if (typeof e === 'string' && e.trim().length > 0) return e;
    }
  }
  return null;
}

export function isOfficialListioTestAccount(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === OFFICIAL_LISTIO_TEST_ACCOUNT_EMAIL;
}
