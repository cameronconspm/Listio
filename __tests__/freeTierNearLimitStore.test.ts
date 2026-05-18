import {
  markNearLimitToastShown,
  resetFreeTierNearLimitToastState,
  wasNearLimitToastShown,
} from '../src/services/freeTierNearLimitStore';

describe('freeTierNearLimitStore', () => {
  beforeEach(async () => {
    await resetFreeTierNearLimitToastState();
  });

  it('tracks per-kind near-limit toast', async () => {
    expect(await wasNearLimitToastShown('list')).toBe(false);
    await markNearLimitToastShown('list');
    expect(await wasNearLimitToastShown('list')).toBe(true);
    expect(await wasNearLimitToastShown('recipe')).toBe(false);
  });
});
