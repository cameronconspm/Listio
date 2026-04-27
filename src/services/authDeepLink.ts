import { supabase } from './supabaseClient';
import { resolveExpoLinkingCreateURL } from '../utils/unwrapExpoModule';

/**
 * Deep link path for password reset (must be listed under Supabase → Authentication → URL Configuration → Redirect URLs).
 * Examples: listio://auth/reset-password, exp://.../--/auth/reset-password (Expo Go dev).
 */
export const PASSWORD_RESET_PATH = 'auth/reset-password';

/**
 * Optional HTTPS page that forwards Supabase tokens into the app (see `web/password-reset-landing.html`).
 * Set `EXPO_PUBLIC_PASSWORD_RESET_WEB_URL` when email clients open your marketing site instead of `listio://`.
 */
function getPasswordResetWebRedirectUrl(): string | null {
  const raw = process.env.EXPO_PUBLIC_PASSWORD_RESET_WEB_URL?.trim();
  if (!raw) return null;
  if (!/^https:\/\//i.test(raw) && !/^http:\/\/localhost/i.test(raw)) {
    return null;
  }
  return raw.replace(/\/$/, '');
}

export function getPasswordResetRedirectTo(): string {
  const webLanding = getPasswordResetWebRedirectUrl();
  if (webLanding) {
    return webLanding;
  }

  const createURL = resolveExpoLinkingCreateURL();
  if (createURL) {
    try {
      return createURL(`/${PASSWORD_RESET_PATH}`);
    } catch {
      // Native module not ready or invalid path — fall back to custom scheme.
    }
  }
  return `listio://${PASSWORD_RESET_PATH}`;
}

function parseAuthParamsFromUrl(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const hashIdx = url.indexOf('#');
  const withoutHash = hashIdx === -1 ? url : url.slice(0, hashIdx);
  const hash = hashIdx === -1 ? '' : url.slice(hashIdx + 1);

  if (hash) {
    const sp = new URLSearchParams(hash);
    sp.forEach((v, k) => {
      params[k] = v;
    });
  }

  const qIdx = withoutHash.indexOf('?');
  if (qIdx !== -1) {
    const sp = new URLSearchParams(withoutHash.slice(qIdx + 1));
    sp.forEach((v, k) => {
      if (!(k in params)) params[k] = v;
    });
  }

  return params;
}

export type ConsumeAuthUrlResult = {
  ok: boolean;
  passwordRecovery: boolean;
};

/**
 * Persists a Supabase session from a redirect URL (implicit hash tokens or PKCE `code`).
 * No-ops with `{ ok: false }` when the URL is not an auth callback.
 */
export async function consumeSupabaseAuthFromUrl(
  url: string | null | undefined
): Promise<ConsumeAuthUrlResult> {
  if (!url || typeof url !== 'string') return { ok: false, passwordRecovery: false };

  const params = parseAuthParamsFromUrl(url);

  if (params.access_token && params.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error) return { ok: false, passwordRecovery: false };
    return { ok: true, passwordRecovery: params.type === 'recovery' };
  }

  if (params.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error || !data.session) return { ok: false, passwordRecovery: false };
    return { ok: true, passwordRecovery: params.type === 'recovery' };
  }

  return { ok: false, passwordRecovery: false };
}
