import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensurePremiumViaContextualPaywall } from '../context/contextualPaywallRef';
import type { ContextualPaywallReason } from '../context/contextualPaywallReasons';
import { resolvePremiumForGate } from './freeTierLimits';

/**
 * Free-taste allowance for the premium AI features. New users get a couple of
 * real uses of Smart add and recipe import so they feel the magic before the
 * paywall — converting on earned desire, not on a blind upsell.
 */
export const FREE_AI_TASTE_USES = 2;

/** Smart add and recipe import each get their own independent free allowance. */
export type AiTasteFeature = 'smart_add' | 'recipe_import';

type AiTasteState = Record<AiTasteFeature, number>;

const STORAGE_KEY = '@listio/ai_feature_taste_v1';

const DEFAULT_STATE: AiTasteState = {
  smart_add: 0,
  recipe_import: 0,
};

async function readState(): Promise<AiTasteState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as Partial<AiTasteState>;
    return {
      smart_add: clampUsed(parsed.smart_add),
      recipe_import: clampUsed(parsed.recipe_import),
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function clampUsed(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
  return Math.min(Math.floor(value), FREE_AI_TASTE_USES);
}

async function writeState(next: AiTasteState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

/** Free uses still available for a feature (0..FREE_AI_TASTE_USES). */
export async function aiTasteRemaining(feature: AiTasteFeature): Promise<number> {
  const state = await readState();
  return Math.max(0, FREE_AI_TASTE_USES - state[feature]);
}

/**
 * Records one consumed free use. Call only after the AI action actually
 * succeeds so a network/parse failure never burns a user's free taste.
 */
export async function commitAiTaste(feature: AiTasteFeature): Promise<void> {
  const state = await readState();
  if (state[feature] >= FREE_AI_TASTE_USES) return;
  await writeState({ ...state, [feature]: state[feature] + 1 });
}

export type AiFeatureGateResult = {
  /** Whether the caller may proceed with the AI action. */
  allowed: boolean;
  /**
   * True when proceeding will spend one of the free-taste uses (so the caller
   * should `commitAiTaste(feature)` after the action succeeds). False when the
   * user is premium or access was granted via the paywall.
   */
  usesFreeAllowance: boolean;
};

/**
 * Gate a premium AI feature with a free-taste allowance.
 *
 * - Premium (or gate disabled): allowed, no allowance consumed.
 * - Free with remaining taste: allowed, caller commits one use on success.
 * - Free with no taste left: presents the contextual paywall and mirrors its result.
 *
 * Does not consume the allowance itself — pair with {@link commitAiTaste} on success.
 */
export async function ensureAiFeatureAccess(
  feature: AiTasteFeature,
  reason: ContextualPaywallReason,
  isKnownPremium?: boolean,
  isPremiumLoading?: boolean
): Promise<AiFeatureGateResult> {
  const premium = await resolvePremiumForGate(isKnownPremium, isPremiumLoading);
  if (premium) return { allowed: true, usesFreeAllowance: false };

  const remaining = await aiTasteRemaining(feature);
  if (remaining > 0) return { allowed: true, usesFreeAllowance: true };

  const allowed = await ensurePremiumViaContextualPaywall(reason);
  return { allowed, usesFreeAllowance: false };
}

/** For tests / debug. */
export async function resetAiFeatureTasteForTests(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
