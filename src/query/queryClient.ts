import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { logger } from '../utils/logger';

/**
 * Default client tuned for React Native: avoid web-centric refetch defaults.
 * Screens can opt in to refetch-on-focus via hooks when migrated from imperative loads.
 */
export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        logger.warnRelease('Query error', query.queryKey, error);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        logger.warnRelease('Mutation error', mutation.options.mutationKey, error);
      },
    }),
    defaultOptions: {
      queries: {
        retry: 1,
        /** RN: wired to AppState via `subscribeReactQueryAppFocus` in `QueryProvider`. */
        refetchOnWindowFocus: true,
        staleTime: 60_000,
        gcTime: 1000 * 60 * 60 * 24 * 7,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
