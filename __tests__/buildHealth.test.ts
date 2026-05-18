jest.mock('../src/services/purchasesService', () => ({
  getRevenueCatIosApiKey: () => '',
  shouldEnforceIosSubscriptionGate: () => false,
}));
jest.mock('../src/services/sentryService', () => ({
  isSentryConfigured: () => false,
}));
jest.mock('../src/services/aiCategoryCache', () => ({
  getCategoryCacheStats: () => ({ entryCount: 0, estimatedBytes: 0 }),
}));

// eslint-disable-next-line import/first -- mocks must register before buildHealth loads purchasesService
import { formatBuildHealthAlert, getBuildHealthSnapshot } from '../src/utils/buildHealth';

describe('buildHealth', () => {
  it('getBuildHealthSnapshot returns expected keys', () => {
    const s = getBuildHealthSnapshot();
    expect(s).toEqual(
      expect.objectContaining({
        supabaseProjectRef: expect.any(String),
        supabaseConfigured: expect.any(Boolean),
        revenueCatIosKeyPresent: expect.any(Boolean),
        sentryConfigured: expect.any(Boolean),
        platform: expect.any(String),
      })
    );
  });

  it('formatBuildHealthAlert includes project ref line', () => {
    const text = formatBuildHealthAlert(getBuildHealthSnapshot());
    expect(text).toContain('Supabase project:');
    expect(text).toContain('RevenueCat iOS API key');
    expect(text).toContain('AI category cache');
  });
});
