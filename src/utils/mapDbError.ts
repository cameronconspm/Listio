import type { PostgrestError } from '@supabase/supabase-js';

function isPostgrestError(err: unknown): err is PostgrestError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    typeof (err as PostgrestError).message === 'string'
  );
}

/** True when the data layer could not resolve a signed-in Supabase user. */
export function isNotSignedInError(err: unknown): boolean {
  return err instanceof Error && err.message === 'Not signed in';
}

/**
 * Maps PostgREST / Supabase errors to safe user-facing messages (no table/column/hint leakage).
 */
export function mapDbErrorToUserMessage(err: unknown, fallback: string): string {
  if (!isPostgrestError(err)) {
    if (err instanceof Error && err.message === 'Recipe not found') return err.message;
    if (err instanceof Error && err.message === 'Meal not found') return err.message;
    if (err instanceof Error && err.message === 'Item not found') return err.message;
    if (err instanceof Error && err.message === 'Not signed in') return err.message;
    return fallback;
  }

  const code = err.code ?? '';
  const message = (err.message ?? '').toLowerCase();
  if (code === 'PGRST116') return 'Nothing was found.';

  if (code === '23514') return fallback;

  if (code === 'PGRST204') {
    return 'This app needs an update before it can save that. Update Listio from the App Store and try again.';
  }

  if (
    code === '42501' ||
    message.includes('row-level security') ||
    message.includes('jwt expired') ||
    message.includes('invalid jwt')
  ) {
    return 'Sign in again to continue.';
  }

  return fallback;
}
