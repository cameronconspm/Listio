import type { HouseholdMemberRow } from '../services/householdService';

/** Profile display name for Share list rows: name → email → role fallback. */
export function householdMemberDisplayName(
  member: Pick<HouseholdMemberRow, 'full_name' | 'email' | 'role'>
): string {
  const name = member.full_name?.trim();
  if (name) return name;
  const email = member.email?.trim();
  if (email) return email;
  return member.role === 'owner' ? 'Owner' : 'Member';
}
