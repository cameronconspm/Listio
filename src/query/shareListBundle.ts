import type { QueryClient } from '@tanstack/react-query';
import {
  fetchHouseholdMembers,
  fetchHouseholdShareScope,
  fetchPendingInvitesForEmail,
  fetchPendingInvitesSent,
  type HouseholdInviteRow,
  type HouseholdMemberRow,
  type HouseholdShareSettings,
} from '../services/householdService';
import { resolveAuthAccountEmail } from '../constants/officialTestAccount';
import { supabase } from '../services/supabaseClient';
import { queryKeys } from './keys';

/** How long share-list settings are treated as fresh (settings hub + screen focus). */
export const SHARE_LIST_STALE_MS = 60_000;

export type ShareListBundle = {
  members: HouseholdMemberRow[];
  shareSettings: HouseholdShareSettings | null;
  isOwner: boolean;
  isSharedHousehold: boolean;
  sentInvites: HouseholdInviteRow[];
  incomingInvites: HouseholdInviteRow[];
};

export async function fetchShareListBundle(): Promise<ShareListBundle> {
  const [memberRows, pendingSent, shareScope] = await Promise.all([
    fetchHouseholdMembers(),
    fetchPendingInvitesSent(),
    fetchHouseholdShareScope(),
  ]);

  let incomingInvites: HouseholdInviteRow[] = [];
  const { data } = await supabase.auth.getUser();
  const email = resolveAuthAccountEmail(data.user);
  if (email) {
    incomingInvites = await fetchPendingInvitesForEmail(email);
  }

  return {
    members: memberRows,
    sentInvites: pendingSent,
    shareSettings: shareScope?.settings ?? null,
    isOwner: shareScope?.isOwner ?? false,
    isSharedHousehold: (shareScope?.memberCount ?? 0) >= 2,
    incomingInvites,
  };
}

export function prefetchShareList(userId: string, queryClient: QueryClient): void {
  void queryClient.prefetchQuery({
    queryKey: queryKeys.shareList(userId),
    queryFn: fetchShareListBundle,
    staleTime: SHARE_LIST_STALE_MS,
  });
}
