import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase, isSyncEnabled } from '../services/supabaseClient';
import { getCurrentHouseholdId } from '../services/householdService';
import { queryKeys } from '../query/keys';

const LIST_REALTIME_ENABLED =
  process.env.EXPO_PUBLIC_LIST_REALTIME?.trim() === '1' ||
  process.env.EXPO_PUBLIC_LIST_REALTIME?.trim().toLowerCase() === 'true';

/**
 * Optional household list sync via Supabase Realtime (`EXPO_PUBLIC_LIST_REALTIME=1`).
 */
export function useListRealtimeSync(userId: string | null | undefined): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!LIST_REALTIME_ENABLED || !isSyncEnabled()) return;
    if (typeof userId !== 'string' || !userId) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let debounceId: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const invalidate = () => {
      if (debounceId) clearTimeout(debounceId);
      debounceId = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.homeList(userId) });
      }, 300);
    };

    void (async () => {
      try {
        const householdId = await getCurrentHouseholdId();
        if (cancelled) return;
        channel = supabase
          .channel(`list_items:${householdId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'list_items',
              filter: `household_id=eq.${householdId}`,
            },
            () => invalidate()
          )
          .subscribe();
      } catch {
        /* household not ready — skip realtime */
      }
    })();

    return () => {
      cancelled = true;
      if (debounceId) clearTimeout(debounceId);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}
