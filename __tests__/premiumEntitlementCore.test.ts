import {
  PREMIUM_ENTITLEMENT_ID,
  buildEntitlementUpsertFromRevenueCatSubscriber,
  isPremiumActiveFromExpirationDates,
} from '../shared/premiumEntitlementCore';

describe('premiumEntitlementCore', () => {
  it('treats future expiry as active', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isPremiumActiveFromExpirationDates(future)).toBe(true);
  });

  it('treats past expiry as inactive', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(isPremiumActiveFromExpirationDates(past)).toBe(false);
  });

  it('treats grace period as active when main expiry passed', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const grace = new Date(Date.now() + 60_000).toISOString();
    expect(isPremiumActiveFromExpirationDates(past, grace)).toBe(true);
  });

  it('maps active RevenueCat subscriber to upsert row', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const upsert = buildEntitlementUpsertFromRevenueCatSubscriber('550e8400-e29b-41d4-a716-446655440000', {
      entitlements: {
        [PREMIUM_ENTITLEMENT_ID]: {
          expires_date: future,
          product_identifier: 'listio_premium_monthly',
        },
      },
      subscriptions: {
        listio_premium_monthly: { store: 'app_store' },
      },
    });
    expect(upsert.is_active).toBe(true);
    expect(upsert.entitlement_id).toBe('premium');
    expect(upsert.product_identifier).toBe('listio_premium_monthly');
    expect(upsert.store).toBe('app_store');
  });

  it('maps subscriber without premium entitlement as inactive', () => {
    const upsert = buildEntitlementUpsertFromRevenueCatSubscriber('550e8400-e29b-41d4-a716-446655440000', {
      entitlements: {},
    });
    expect(upsert.is_active).toBe(false);
  });
});
