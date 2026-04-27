import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase, isSyncEnabled } from './supabaseClient';
import { clearAllLocalData } from './localDataService';
import { clearAllRecentItems } from './recentItemsStore';
import { clearCategoryCache } from './aiCategoryCache';

type DeleteAccountResponse = { ok?: boolean; error?: string };

async function readEdgeFunctionErrorMessage(error: unknown): Promise<string | null> {
  if (!(error instanceof FunctionsHttpError)) return null;
  const res = error.context as Response;
  try {
    const text = await res.clone().text();
    const trimmed = text.trim();
    if (!trimmed) return null;
    const parsed = JSON.parse(trimmed) as { error?: unknown };
    if (typeof parsed.error === 'string' && parsed.error.trim()) return parsed.error.trim();
  } catch {
    /* ignore */
  }
  return null;
}

function messageForDeleteAccountFailure(status: number | undefined, fromBody: string | null): string {
  if (status === 401) {
    return 'Your session expired. Sign in again, then try deleting your account.';
  }
  if (status === 404) {
    return 'Account deletion isn’t available from the server right now. Please try again later or contact support.';
  }
  if (fromBody) return fromBody;
  if (status === 400) {
    return 'Could not finish deleting your account data. Please try again or contact support.';
  }
  if (status === 503 || status === 502 || status === 500) {
    return 'The server could not complete account deletion. Please try again later.';
  }
  return 'Could not delete your account. Please try again.';
}

/**
 * Permanently deletes the signed-in user via Edge Function (household cleanup + Auth admin).
 * Clears local mirrors and session on success.
 */
export async function deleteAuthenticatedAccount(): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isSyncEnabled()) {
    return { ok: false, message: 'Cloud sign-in is required to delete your account.' };
  }

  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr || !sessionData.session) {
    return { ok: false, message: 'Sign in again to delete your account.' };
  }

  const { data, error } = await supabase.functions.invoke<DeleteAccountResponse>('delete-account', {
    body: {},
    headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
  });

  if (error) {
    const fromBody = await readEdgeFunctionErrorMessage(error);
    const status =
      error instanceof FunctionsHttpError ? (error.context as Response).status : undefined;
    return { ok: false, message: messageForDeleteAccountFailure(status, fromBody) };
  }
  if (data?.error) {
    return { ok: false, message: data.error };
  }
  if (!data?.ok) {
    return { ok: false, message: 'Could not delete your account. Please try again.' };
  }

  await clearAllRecentItems();
  await clearCategoryCache();
  await clearAllLocalData();
  await supabase.auth.signOut({ scope: 'local' });
  return { ok: true };
}
