import { supabase, isSyncEnabled } from './supabaseClient';
import { mapDbErrorToUserMessage } from '../utils/mapDbError';
import { resolveDataScopeId, requireAuthenticatedUserId } from './syncInsertScope';

export type HouseholdShareSettings = {
  /** Grocery list is always shared when collaborating. */
  shareList: true;
  shareMeals: boolean;
  shareRecipes: boolean;
};

export type HouseholdShareScope = {
  householdId: string;
  memberCount: number;
  isOwner: boolean;
  settings: HouseholdShareSettings;
};

const DEFAULT_SETTINGS: HouseholdShareSettings = {
  shareList: true,
  shareMeals: true,
  shareRecipes: true,
};

function parseShareSettings(metadata: unknown): HouseholdShareSettings {
  const raw =
    metadata && typeof metadata === 'object' && 'share' in metadata
      ? (metadata as { share?: Record<string, unknown> }).share
      : null;
  return {
    shareList: true,
    shareMeals: raw?.shareMeals !== false,
    shareRecipes: raw?.shareRecipes !== false,
  };
}

/** Load share toggles + membership context for the active household. */
export async function fetchHouseholdShareScope(): Promise<HouseholdShareScope | null> {
  if (!isSyncEnabled()) return null;
  const uid = await requireAuthenticatedUserId();
  const householdId = await resolveDataScopeId();

  const [{ data: household, error: householdError }, { data: members, error: membersError }] =
    await Promise.all([
      supabase.from('households').select('id, metadata').eq('id', householdId).maybeSingle(),
      supabase.from('household_members').select('user_id, role').eq('household_id', householdId),
    ]);

  if (householdError) {
    throw new Error(mapDbErrorToUserMessage(householdError, 'Could not load sharing settings.'));
  }
  if (membersError) {
    throw new Error(mapDbErrorToUserMessage(membersError, 'Could not load sharing settings.'));
  }
  if (!household?.id) return null;

  const memberRows = members ?? [];
  const self = memberRows.find((m) => m.user_id === uid);
  return {
    householdId: String(household.id),
    memberCount: memberRows.length,
    isOwner: self?.role === 'owner',
    settings: parseShareSettings(household.metadata),
  };
}

export async function updateHouseholdShareSettings(
  patch: Partial<Pick<HouseholdShareSettings, 'shareMeals' | 'shareRecipes'>>,
  options?: { currentSettings?: HouseholdShareSettings }
): Promise<HouseholdShareSettings> {
  if (!isSyncEnabled()) throw new Error('Sign in to update sharing settings.');
  const householdId = await resolveDataScopeId();

  let baseSettings: HouseholdShareSettings;
  if (options?.currentSettings) {
    baseSettings = options.currentSettings;
  } else {
    const scope = await fetchHouseholdShareScope();
    if (!scope?.isOwner) throw new Error('Only the list owner can change what is shared.');
    baseSettings = scope.settings;
  }

  const next: HouseholdShareSettings = {
    shareList: true,
    shareMeals: patch.shareMeals ?? baseSettings.shareMeals,
    shareRecipes: patch.shareRecipes ?? baseSettings.shareRecipes,
  };

  const { data: current, error: readError } = await supabase
    .from('households')
    .select('metadata')
    .eq('id', householdId)
    .maybeSingle();

  if (readError) {
    throw new Error(mapDbErrorToUserMessage(readError, 'Could not update sharing settings.'));
  }

  const metadata =
    current?.metadata && typeof current.metadata === 'object' && !Array.isArray(current.metadata)
      ? { ...(current.metadata as Record<string, unknown>) }
      : {};

  metadata.share = {
    shareList: true,
    shareMeals: next.shareMeals,
    shareRecipes: next.shareRecipes,
  };

  const { error: updateError } = await supabase
    .from('households')
    .update({ metadata })
    .eq('id', householdId);

  if (updateError) {
    throw new Error(mapDbErrorToUserMessage(updateError, 'Could not update sharing settings.'));
  }

  return next;
}

/**
 * When collaborating, members may only see household meals/recipes if the owner enabled sharing.
 * Owners always see the full household scope.
 */
export async function resolveHouseholdContentFilter(
  userId: string,
  kind: 'meals' | 'recipes'
): Promise<{ householdId: string; restrictToUserId: string | null }> {
  const householdId = await resolveDataScopeId();
  if (!isSyncEnabled()) {
    return { householdId, restrictToUserId: userId };
  }

  const scope = await fetchHouseholdShareScope();
  if (!scope || scope.memberCount < 2) {
    return { householdId, restrictToUserId: null };
  }

  const shared =
    kind === 'meals' ? scope.settings.shareMeals : scope.settings.shareRecipes;

  if (scope.isOwner || shared) {
    return { householdId, restrictToUserId: null };
  }

  return { householdId, restrictToUserId: userId };
}

export { DEFAULT_SETTINGS as defaultHouseholdShareSettings };
