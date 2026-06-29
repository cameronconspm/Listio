import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase, isSyncEnabled } from '../services/supabaseClient';
import { queryKeys } from '../query/keys';

const LIST_REALTIME_ENABLED =
  process.env.EXPO_PUBLIC_LIST_REALTIME?.trim() === '1' ||
  process.env.EXPO_PUBLIC_LIST_REALTIME?.trim().toLowerCase() === 'true';

/**
 * Optional list sync via Supabase Realtime (`EXPO_PUBLIC_LIST_REALTIME=1`).
 */
export function useListRealtimeSync(userId: string | null | undefined): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!LIST_REALTIME_ENABLED || !isSyncEnabled()) return;
    if (typeof userId !== 'string' || !userId) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let debounceId: ReturnType<typeof setTimeout> | null = null;

    const invalidate = () => {
      if (debounceId) clearTimeout(debounceId);
      debounceId = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.homeListAll(userId) });
      }, 300);
    };

    channel = supabase
      .channel(`list_items:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'list_items',
          filter: `user_id=eq.${userId}`,
        },
        () => invalidate()
      )
      .subscribe();

    return () => {
      if (debounceId) clearTimeout(debounceId);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}
