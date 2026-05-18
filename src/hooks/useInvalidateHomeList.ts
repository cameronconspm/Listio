import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../query/keys';
import { useAuthUserId } from '../context/AuthContext';

/**
 * Invalidates the home list bundle after list/store mutations.
 */
export function useInvalidateHomeList() {
  const queryClient = useQueryClient();
  const userId = useAuthUserId();
  return useCallback(async () => {
    const uid = typeof userId === 'string' ? userId : null;
    if (!uid) return;
    await queryClient.invalidateQueries({ queryKey: queryKeys.homeList(uid) });
    await queryClient.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) &&
        q.queryKey[0] === 'listio' &&
        q.queryKey[1] === 'mealDetail' &&
        q.queryKey[2] === uid,
    });
  }, [queryClient, userId]);
}
