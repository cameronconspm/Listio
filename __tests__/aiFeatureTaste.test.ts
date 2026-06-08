import {
  ensureAiFeatureAccess,
  commitAiTaste,
  aiTasteRemaining,
  resetAiFeatureTasteForTests,
  FREE_AI_TASTE_USES,
} from '../src/services/aiFeatureTaste';

jest.mock('../src/context/contextualPaywallRef', () => ({
  ensurePremiumViaContextualPaywall: jest.fn(async () => false),
}));

jest.mock('../src/services/purchasesService', () => ({
  fetchPremiumEntitlementActive: jest.fn(async () => false),
  shouldEnforceIosSubscriptionGate: jest.fn(() => true),
}));

jest.mock('../src/services/subscriptionEntitlementSyncService', () => ({
  ensureServerSubscriptionMirror: jest.fn(async () => undefined),
}));

const { ensurePremiumViaContextualPaywall } = jest.requireMock('../src/context/contextualPaywallRef');
const { fetchPremiumEntitlementActive, shouldEnforceIosSubscriptionGate } = jest.requireMock(
  '../src/services/purchasesService'
);

beforeEach(async () => {
  jest.clearAllMocks();
  shouldEnforceIosSubscriptionGate.mockReturnValue(true);
  fetchPremiumEntitlementActive.mockResolvedValue(false);
  ensurePremiumViaContextualPaywall.mockResolvedValue(false);
  await resetAiFeatureTasteForTests();
});

describe('ai feature free taste', () => {
  it('starts with the full free allowance', async () => {
    expect(await aiTasteRemaining('smart_add')).toBe(FREE_AI_TASTE_USES);
    expect(await aiTasteRemaining('recipe_import')).toBe(FREE_AI_TASTE_USES);
  });

  it('allows the free uses, then presents the paywall', async () => {
    for (let i = 0; i < FREE_AI_TASTE_USES; i++) {
      const gate = await ensureAiFeatureAccess('smart_add', 'smart_add', false, false);
      expect(gate.allowed).toBe(true);
      expect(gate.usesFreeAllowance).toBe(true);
      await commitAiTaste('smart_add');
    }
    expect(await aiTasteRemaining('smart_add')).toBe(0);
    expect(ensurePremiumViaContextualPaywall).not.toHaveBeenCalled();

    const blocked = await ensureAiFeatureAccess('smart_add', 'smart_add', false, false);
    expect(blocked.allowed).toBe(false);
    expect(blocked.usesFreeAllowance).toBe(false);
    expect(ensurePremiumViaContextualPaywall).toHaveBeenCalledWith('smart_add');
  });

  it('does not consume the allowance until commit is called', async () => {
    await ensureAiFeatureAccess('smart_add', 'smart_add', false, false);
    await ensureAiFeatureAccess('smart_add', 'smart_add', false, false);
    expect(await aiTasteRemaining('smart_add')).toBe(FREE_AI_TASTE_USES);
  });

  it('keeps each feature allowance independent', async () => {
    for (let i = 0; i < FREE_AI_TASTE_USES; i++) await commitAiTaste('smart_add');
    expect(await aiTasteRemaining('smart_add')).toBe(0);
    expect(await aiTasteRemaining('recipe_import')).toBe(FREE_AI_TASTE_USES);
  });

  it('never lets commit exceed the cap', async () => {
    for (let i = 0; i < FREE_AI_TASTE_USES + 3; i++) await commitAiTaste('recipe_import');
    expect(await aiTasteRemaining('recipe_import')).toBe(0);
  });

  it('bypasses the gate for known premium without consuming allowance', async () => {
    const gate = await ensureAiFeatureAccess('recipe_import', 'recipe_url', true, false);
    expect(gate.allowed).toBe(true);
    expect(gate.usesFreeAllowance).toBe(false);
    expect(ensurePremiumViaContextualPaywall).not.toHaveBeenCalled();
    expect(await aiTasteRemaining('recipe_import')).toBe(FREE_AI_TASTE_USES);
  });

  it('treats a disabled subscription gate as premium', async () => {
    shouldEnforceIosSubscriptionGate.mockReturnValue(false);
    const gate = await ensureAiFeatureAccess('smart_add', 'smart_add', false, false);
    expect(gate.allowed).toBe(true);
    expect(gate.usesFreeAllowance).toBe(false);
  });

  it('re-checks RevenueCat while premium is loading', async () => {
    fetchPremiumEntitlementActive.mockResolvedValue(true);
    const gate = await ensureAiFeatureAccess('smart_add', 'smart_add', false, true);
    expect(gate.allowed).toBe(true);
    expect(gate.usesFreeAllowance).toBe(false);
    expect(fetchPremiumEntitlementActive).toHaveBeenCalled();
  });
});
