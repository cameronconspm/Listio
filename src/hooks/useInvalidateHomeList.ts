import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../query/keys';
import { getUserId } from '../services/supabaseClient';

/**
 * Invalidates the home list bundle after list/store mutations.
 */
export function useInvalidateHomeList() {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    const uid = await getUserId();
    if (!uid) return;
    await queryClient.invalidateQueries({ queryKey: queryKeys.homeList(uid) });
    await queryClient.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) &&
        q.queryKey[0] === 'listio' &&
        q.queryKey[1] === 'mealDetail' &&
        q.queryKey[2] === uid,
    });
  }, [queryClient]);
}
