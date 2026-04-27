import type { PostgrestError } from '@supabase/supabase-js';

function isPostgrestError(err: unknown): err is PostgrestError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    typeof (err as PostgrestError).message === 'string'
  );
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
  if (code === 'PGRST116') return 'Nothing was found.';

  if (code === '23514') return fallback;

  if (code === 'PGRST204') {
    return 'The database is missing a column this app version expects. Apply the latest Listio Supabase migrations on your project, then try again. If you already ran them, reload the API schema from the Supabase dashboard.';
  }

  return fallback;
}
