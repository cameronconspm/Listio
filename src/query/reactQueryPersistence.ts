import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

/** Bump if persisted shape changes and you need to discard old caches. */
export const LISTIO_QUERY_CACHE_KEY = '@listio/react-query-v1';

export function createListioQueryPersister() {
  return createAsyncStoragePersister({
    storage: AsyncStorage,
    key: LISTIO_QUERY_CACHE_KEY,
    throttleTime: 2000,
  });
}

/** Call on sign-out / account deletion so the next user never reads prior session cache. */
export async function clearPersistedQueryCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LISTIO_QUERY_CACHE_KEY);
  } catch {
    /* ignore */
  }
}
