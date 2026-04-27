import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type AuthError } from '@supabase/supabase-js';

type SupabaseExtra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

function readExpoExtra(): SupabaseExtra | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- defer ExponentConstants until safe; env fallback if throws
    const Constants = require('expo-constants') as typeof import('expo-constants');
    const mod = Constants.default ?? Constants;
    return mod.expoConfig?.extra as SupabaseExtra | undefined;
  } catch {
    return undefined;
  }
}

const extra = readExpoExtra();

/** Metro inlines EXPO_PUBLIC_*; app.config.js also sets expo.extra as fallback when env is missing at bundle time. */
const supabaseUrl =
  (process.env.EXPO_PUBLIC_SUPABASE_URL || '') ||
  (typeof extra?.supabaseUrl === 'string' ? extra.supabaseUrl : '') ||
  '';
const supabaseAnonKey =
  (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '') ||
  (typeof extra?.supabaseAnonKey === 'string' ? extra.supabaseAnonKey : '') ||
  '';
export const isSupabaseConfigured = (): boolean =>
  Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http'));

/** Project URL for Edge Function endpoints (e.g. authenticated Place Photo proxy). */
export function getSupabaseProjectUrl(): string {
  return supabaseUrl;
}

/** True when Supabase URL + anon key are set — the app is cloud-backed only (no local-only data path at runtime). */
export const isSyncEnabled = (): boolean => isSupabaseConfigured();

/** URL/anon key missing — block startup (see App MisconfiguredSupabaseView). */
export const isSupabaseSyncRequiredButMisconfigured = (): boolean => !isSupabaseConfigured();

/** Legacy id for migrating local-only data after sign-in; not used as a live user id when Supabase is configured. */
export const LOCAL_USER_ID = 'local-user';

/** Returns the signed-in Supabase user id, or null if not configured or not signed in. */
export async function getUserId(): Promise<string | null> {
  if (!isSyncEnabled()) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Project ref (e.g. abcdefgh) or 'local' for debugging — which Supabase project the app uses. */
export const getSupabaseProjectRef = (): string => {
  try {
    if (!supabaseUrl) return 'not-configured';
    const m = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
    if (m) return m[1];
    if (supabaseUrl.includes('127.0.0.1') || supabaseUrl.includes('localhost')) return 'local';
    return 'custom-host';
  } catch {
    return 'unknown';
  }
};

/**
 * Extract project ref from JWT `iss` (public, not secret). Mismatch vs getSupabaseProjectRef()
 * causes Edge/REST to return 401 Invalid JWT while the app still "looks" signed in.
 */
export function parseJwtProjectRefFromAccessToken(accessToken: string): string | null {
  try {
    const parts = accessToken.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { iss?: string };
    const iss = String(payload.iss ?? '');
    const m = iss.match(/https:\/\/([^.]+)\.supabase\.co/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/**
 * Supabase session JSON often exceeds Expo SecureStore’s ~2048-byte practical limit.
 * Truncated storage → corrupt access_token → Edge Functions gateway returns 401 Invalid JWT.
 * AsyncStorage matches Supabase’s React Native guidance for auth persistence.
 */
const authOpts = {
  storage: AsyncStorage,
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: false,
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: authOpts,
});

/** True when the stored refresh token is no longer valid on the server (revoked, rotated, or missing). */
export function isCorruptSupabaseRefreshTokenError(error: AuthError | null | undefined): boolean {
  if (!error) return false;
  const code = error.code;
  if (code === 'refresh_token_not_found' || code === 'refresh_token_already_used') return true;
  const msg = (error.message || '').toLowerCase();
  return (
    (msg.includes('refresh token') && msg.includes('not found')) ||
    msg.includes('invalid refresh token')
  );
}

/**
 * Clears local auth storage when the refresh token cannot be used anymore.
 * Avoids repeated failed refresh attempts and noisy AuthApiError logs on next launch.
 * @returns whether local sign-out was performed
 */
export async function signOutLocallyIfCorruptRefreshToken(
  error: AuthError | null | undefined
): Promise<boolean> {
  if (!isCorruptSupabaseRefreshTokenError(error)) return false;
  await supabase.auth.signOut({ scope: 'local' });
  return true;
}
