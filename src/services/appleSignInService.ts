import { Platform } from 'react-native';
import { supabase } from './supabaseClient';
import { logFunnelEvent } from './funnelAnalyticsService';

type AppleSignInResult =
  | { ok: true }
  | { ok: false; cancelled: boolean; message?: string };

/** Sign in with Apple via Supabase OAuth id token (iOS only). */
export async function signInWithApple(): Promise<AppleSignInResult> {
  if (Platform.OS !== 'ios') {
    return { ok: false, cancelled: false, message: 'Sign in with Apple is only available on iOS.' };
  }

  try {
    const AppleAuthentication = await import('expo-apple-authentication');
    const available = await AppleAuthentication.isAvailableAsync();
    if (!available) {
      return { ok: false, cancelled: false, message: 'Sign in with Apple is not available on this device.' };
    }

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      return { ok: false, cancelled: false, message: 'Apple did not return a sign-in token.' };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });

    if (error) {
      return { ok: false, cancelled: false, message: error.message };
    }

    logFunnelEvent('auth_login_success', { method: 'apple' });
    return { ok: true };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.code === 'ERR_REQUEST_CANCELED') {
      return { ok: false, cancelled: true };
    }
    return {
      ok: false,
      cancelled: false,
      message: err.message ?? 'Sign in with Apple failed.',
    };
  }
}
