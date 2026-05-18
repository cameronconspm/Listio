import {
  ensureFreeTierCapacity,
  freeTierUsageSummary,
  FREE_LIST_ITEMS_LIMIT,
} from '../src/services/freeTierLimits';

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

describe('freeTierUsageSummary', () => {
  it('marks near limit when one slot remains', () => {
    const s = freeTierUsageSummary('list', FREE_LIST_ITEMS_LIMIT - 1);
    expect(s.nearLimit).toBe(true);
    expect(s.atLimit).toBe(false);
    expect(s.remaining).toBe(1);
  });

  it('marks at limit when count meets cap', () => {
    const s = freeTierUsageSummary('list', FREE_LIST_ITEMS_LIMIT);
    expect(s.atLimit).toBe(true);
    expect(s.nearLimit).toBe(false);
  });
});

describe('ensureFreeTierCapacity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    shouldEnforceIosSubscriptionGate.mockReturnValue(true);
    fetchPremiumEntitlementActive.mockResolvedValue(false);
    ensurePremiumViaContextualPaywall.mockResolvedValue(false);
  });

  it('allows when under limit', async () => {
    const ok = await ensureFreeTierCapacity('list', 1, 1, false, false);
    expect(ok).toBe(true);
    expect(ensurePremiumViaContextualPaywall).not.toHaveBeenCalled();
  });

  it('skips paywall when known premium', async () => {
    const ok = await ensureFreeTierCapacity('list', 10, 1, true, false);
    expect(ok).toBe(true);
    expect(fetchPremiumEntitlementActive).not.toHaveBeenCalled();
  });

  it('re-checks RevenueCat when premium is loading', async () => {
    fetchPremiumEntitlementActive.mockResolvedValue(true);
    const ok = await ensureFreeTierCapacity('list', 10, 1, false, true);
    expect(ok).toBe(true);
    expect(fetchPremiumEntitlementActive).toHaveBeenCalled();
    expect(ensurePremiumViaContextualPaywall).not.toHaveBeenCalled();
  });

  it('presents paywall when over limit and not premium', async () => {
    const ok = await ensureFreeTierCapacity('list', FREE_LIST_ITEMS_LIMIT, 1, false, false);
    expect(ok).toBe(false);
    expect(ensurePremiumViaContextualPaywall).toHaveBeenCalledWith('list_limit');
  });
});
