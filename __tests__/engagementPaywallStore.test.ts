import {
  incrementMeaningfulAction,
  markSoftPaywallPresented,
  MEANINGFUL_ACTIONS_THRESHOLD,
  resetEngagementPaywallState,
} from '../src/services/engagementPaywallStore';

describe('engagementPaywallStore', () => {
  beforeEach(async () => {
    await resetEngagementPaywallState();
  });

  it('increments count and signals soft paywall at threshold', async () => {
    for (let i = 0; i < MEANINGFUL_ACTIONS_THRESHOLD - 1; i++) {
      const { shouldOfferSoftPaywall } = await incrementMeaningfulAction();
      expect(shouldOfferSoftPaywall).toBe(false);
    }
    const last = await incrementMeaningfulAction();
    expect(last.shouldOfferSoftPaywall).toBe(true);
    expect(last.state.meaningfulActionCount).toBe(MEANINGFUL_ACTIONS_THRESHOLD);
  });

  it('stops incrementing offers after soft paywall marked presented', async () => {
    for (let i = 0; i < MEANINGFUL_ACTIONS_THRESHOLD; i++) {
      await incrementMeaningfulAction();
    }
    await markSoftPaywallPresented();
    const after = await incrementMeaningfulAction();
    expect(after.shouldOfferSoftPaywall).toBe(false);
  });
});
