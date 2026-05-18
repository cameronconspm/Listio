import type { PostgrestError } from '@supabase/supabase-js';
import { mapDbErrorToUserMessage } from './mapDbError';

/** Thrown when a Supabase fetch fails; React Query surfaces this as `isError`. */
export class ServiceFetchError extends Error {
  readonly code: string | undefined;

  constructor(
    message: string,
    readonly cause?: PostgrestError | Error
  ) {
    super(message);
    this.name = 'ServiceFetchError';
    if (cause && 'code' in cause && typeof cause.code === 'string') {
      this.code = cause.code;
    }
  }
}

export function throwOnSupabaseFetchError(
  error: PostgrestError | null,
  fallbackMessage: string
): void {
  if (!error) return;
  throw new ServiceFetchError(mapDbErrorToUserMessage(error, fallbackMessage), error);
}
