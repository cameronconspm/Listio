import { supabase, isSyncEnabled } from './supabaseClient';
import { mapDbErrorToUserMessage } from '../utils/mapDbError';
import { resolveDataScopeId, invalidateDataScopeCache, requireAuthenticatedUserId } from './syncInsertScope';
import { patchUserPreferences } from './userPreferencesService';
import { invalidateDefaultListIdCache } from './shoppingListService';

export type HouseholdMemberRow = {
  user_id: string;
  role: 'owner' | 'member';
  email: string | null;
  full_name: string | null;
};

export type HouseholdInviteRow = {
  id: string;
  household_id: string;
  invitee_email: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

export type AcceptInviteResult =
  | { ok: true; householdId: string }
  | { ok: false; error: string };

function randomToken(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID().replace(/-/g, '');
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

async function verifyHouseholdMembership(householdId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('household_members')
    .select('user_id')
    .eq('household_id', householdId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return false;
  return Boolean(data?.user_id);
}

export async function fetchHouseholdMembers(): Promise<HouseholdMemberRow[]> {
  if (!isSyncEnabled()) return [];
  const householdId = await resolveDataScopeId();
  const { data, error } = await supabase
    .from('household_members')
    .select('user_id, role')
    .eq('household_id', householdId);

  if (error) {
    throw new Error(mapDbErrorToUserMessage(error, 'Could not load household members.'));
  }

  return (data ?? []).map((row) => ({
    user_id: String(row.user_id),
    role: row.role as 'owner' | 'member',
    email: null,
    full_name: null,
  }));
}

export async function fetchPendingInvitesSent(): Promise<HouseholdInviteRow[]> {
  if (!isSyncEnabled()) return [];
  const householdId = await resolveDataScopeId();
  const { data, error } = await supabase
    .from('household_invites')
    .select('id, household_id, invitee_email, token, expires_at, accepted_at, created_at')
    .eq('household_id', householdId)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(mapDbErrorToUserMessage(error, 'Could not load invites.'));
  }
  return (data ?? []) as HouseholdInviteRow[];
}

export async function fetchPendingInvitesForEmail(email: string): Promise<HouseholdInviteRow[]> {
  if (!isSyncEnabled()) return [];
  const normalized = email.trim().toLowerCase();
  const { data, error } = await supabase
    .from('household_invites')
    .select('id, household_id, invitee_email, token, expires_at, accepted_at, created_at')
    .ilike('invitee_email', normalized)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(mapDbErrorToUserMessage(error, 'Could not load invites.'));
  }
  return (data ?? []) as HouseholdInviteRow[];
}

export async function createHouseholdInvite(inviteeEmail: string): Promise<HouseholdInviteRow> {
  if (!isSyncEnabled()) throw new Error('Sign in to share your list.');
  const uid = await requireAuthenticatedUserId();
  const householdId = await resolveDataScopeId();
  const email = inviteeEmail.trim().toLowerCase();
  if (!email.includes('@')) throw new Error('Enter a valid email address.');

  const token = randomToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('household_invites')
    .insert({
      household_id: householdId,
      inviter_id: uid,
      invitee_email: email,
      token,
      expires_at: expiresAt,
    })
    .select('id, household_id, invitee_email, token, expires_at, accepted_at, created_at')
    .single();

  if (error) {
    throw new Error(mapDbErrorToUserMessage(error, 'Could not send invite.'));
  }
  return data as HouseholdInviteRow;
}

export async function revokeHouseholdInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.from('household_invites').delete().eq('id', inviteId);
  if (error) {
    throw new Error(mapDbErrorToUserMessage(error, 'Could not revoke invite.'));
  }
}

export async function acceptHouseholdInvite(token: string): Promise<AcceptInviteResult> {
  if (!isSyncEnabled()) return { ok: false, error: 'not_signed_in' };
  const uid = await requireAuthenticatedUserId();
  const { data, error } = await supabase.rpc('accept_household_invite', { p_token: token.trim() });
  if (error) {
    return { ok: false, error: mapDbErrorToUserMessage(error, 'Could not accept invite.') };
  }
  const payload = data as { ok?: boolean; error?: string; household_id?: string } | null;
  if (!payload?.ok || !payload.household_id) {
    return { ok: false, error: payload?.error ?? 'invalid_or_expired' };
  }

  await patchUserPreferences({
    householdUi: { activeHouseholdId: String(payload.household_id) },
  });
  invalidateDataScopeCache(uid);
  invalidateDefaultListIdCache();
  return { ok: true, householdId: String(payload.household_id) };
}

export function buildHouseholdInviteUrl(token: string): string {
  return `listio://invite?token=${encodeURIComponent(token)}`;
}

export function parseHouseholdInviteTokenFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'listio:') return null;
    if (parsed.hostname !== 'invite' && !parsed.pathname.includes('invite')) return null;
    const token = parsed.searchParams.get('token');
    return token?.trim() || null;
  } catch {
    return null;
  }
}

export async function activateSharedHousehold(householdId: string): Promise<void> {
  const uid = await requireAuthenticatedUserId();
  const ok = await verifyHouseholdMembership(householdId, uid);
  if (!ok) throw new Error('You are not a member of this household.');
  await patchUserPreferences({ householdUi: { activeHouseholdId: householdId } });
  invalidateDataScopeCache(uid);
  invalidateDefaultListIdCache();
}
