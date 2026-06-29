import { supabase, isSyncEnabled } from './supabaseClient';
import { getValidAccessTokenForEdgeInvoke } from './edgeInvocationAuth';

/** Best-effort push to an invitee who already has the app + notifications enabled. */
export async function notifyHouseholdInvitePush(inviteId: string): Promise<void> {
  if (!isSyncEnabled()) return;
  const token = await getValidAccessTokenForEdgeInvoke('householdInvitePush');
  const { error } = await supabase.functions.invoke('household-invite-push', {
    body: { inviteId },
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) {
    // Non-blocking — link share is the primary delivery path.
    console.warn('[householdInvitePush]', error.message);
  }
}
