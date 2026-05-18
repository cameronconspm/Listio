import { Alert } from 'react-native';
import { restorePurchasesWithUserFeedback } from '../src/services/restorePurchasesFlow';

jest.mock('../src/services/purchasesService', () => ({
  customerInfoHasPremium: jest.fn(() => true),
  getRevenueCatIosApiKey: jest.fn(() => 'test-key'),
  isRevenueCatNativeLayerSkipped: jest.fn(() => false),
  restorePurchases: jest.fn(async () => ({})),
  shouldEnforceIosSubscriptionGate: jest.fn(() => true),
}));

jest.mock('../src/services/subscriptionEntitlementSyncService', () => ({
  ensureServerSubscriptionMirror: jest.fn(async () => undefined),
}));

const { restorePurchases } = jest.requireMock('../src/services/purchasesService');

describe('restorePurchasesWithUserFeedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns true and alerts on successful restore', async () => {
    const onPremiumActive = jest.fn();
    const ok = await restorePurchasesWithUserFeedback({ onPremiumActive });
    expect(ok).toBe(true);
    expect(restorePurchases).toHaveBeenCalled();
    expect(onPremiumActive).toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Restored', expect.any(String));
  });
});
