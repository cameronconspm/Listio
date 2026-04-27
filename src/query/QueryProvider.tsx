import React, { useEffect, useState } from 'react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAppQueryClient } from './queryClient';
import { createListioQueryPersister } from './reactQueryPersistence';
import { subscribeReactQueryAppFocus } from './setupReactQueryAppFocus';
import { queryKeys } from './keys';

type Props = { children: React.ReactNode };

const PERSIST_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

/**
 * TanStack Query + AsyncStorage persistence so cold starts can show last-known data immediately.
 * Foreground refetch is enabled via AppState → `focusManager`.
 */
export function QueryProvider({ children }: Props) {
  const [client] = useState(() => createAppQueryClient());
  const [persister] = useState(() => createListioQueryPersister());

  useEffect(() => subscribeReactQueryAppFocus(), []);

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        maxAge: PERSIST_MAX_AGE_MS,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) =>
            query.state.status === 'success' &&
            Array.isArray(query.queryKey) &&
            query.queryKey[0] === queryKeys.root[0],
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
