import * as SubscriptionSync from '../src/services/subscriptionEntitlementSyncService';

jest.mock('../src/services/supabaseClient', () => ({
  isSyncEnabled: () => true,
  hasValidSupabaseSession: jest.fn().mockResolvedValue(true),
  supabase: {
    functions: {
      invoke: jest.fn().mockResolvedValue({ data: { synced: true, is_active: true }, error: null }),
    },
  },
}));

jest.mock('../src/constants/subscription', () => ({
  subscriptionPlatformEnforced: () => true,
}));

jest.mock('../src/services/edgeInvocationAuth', () => ({
  getValidAccessTokenForEdgeInvoke: jest.fn().mockResolvedValue({ accessToken: 'token' }),
}));

describe('ensureServerSubscriptionMirror', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns mirror payload when sync completes before timeout', async () => {
    await expect(SubscriptionSync.ensureServerSubscriptionMirror()).resolves.toEqual({
      synced: true,
      isActive: true,
    });
  });

  it('returns null when sync exceeds timeout', async () => {
    const { supabase } = jest.requireMock('../src/services/supabaseClient') as {
      supabase: { functions: { invoke: jest.Mock } };
    };
    supabase.functions.invoke.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () => resolve({ data: { synced: true, is_active: true }, error: null }),
            SubscriptionSync.SERVER_MIRROR_SYNC_TIMEOUT_MS + 500
          );
        })
    );

    const promise = SubscriptionSync.ensureServerSubscriptionMirror();
    jest.advanceTimersByTime(SubscriptionSync.SERVER_MIRROR_SYNC_TIMEOUT_MS + 100);
    await expect(promise).resolves.toBeNull();
  });
});
