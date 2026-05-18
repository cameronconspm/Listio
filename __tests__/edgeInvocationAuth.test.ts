import { supabase } from '../src/services/supabaseClient';
import {
  getValidAccessTokenForEdgeInvoke,
  invalidateEdgeInvocationAuthCache,
} from '../src/services/edgeInvocationAuth';

jest.mock('../src/services/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      refreshSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
  },
  getSupabaseProjectRef: () => 'not-configured',
  parseJwtProjectRefFromAccessToken: () => null,
  signOutLocallyIfCorruptRefreshToken: jest.fn().mockResolvedValue(false),
}));

const getSessionMock = supabase.auth.getSession as jest.Mock;
const refreshSessionMock = supabase.auth.refreshSession as jest.Mock;

describe('edgeInvocationAuth', () => {
  beforeEach(() => {
    invalidateEdgeInvocationAuthCache();
    getSessionMock.mockReset();
    refreshSessionMock.mockReset();
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: 'token-a',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { id: 'user-z' },
        },
      },
      error: null,
    });
    refreshSessionMock.mockResolvedValue({ data: { session: null }, error: null });
  });

  it('dedupes concurrent getSession via single-flight', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    getSessionMock.mockImplementationOnce(
      () =>
        gate.then(() => ({
          data: {
            session: {
              access_token: 'token-b',
              expires_at: Math.floor(Date.now() / 1000) + 3600,
              user: { id: 'user-z' },
            },
          },
          error: null,
        }))
    );

    const p1 = getValidAccessTokenForEdgeInvoke('categorizeItems');
    const p2 = getValidAccessTokenForEdgeInvoke('categorizeItems');
    release();
    const [a, b] = await Promise.all([p1, p2]);
    expect(a.accessToken).toBe('token-b');
    expect(b.accessToken).toBe('token-b');
    expect(getSessionMock).toHaveBeenCalledTimes(1);
  });

  it('reuses the cached token on a second call without calling getSession again', async () => {
    const first = await getValidAccessTokenForEdgeInvoke('categorizeItems');
    expect(first.accessToken).toBe('token-a');
    expect(getSessionMock).toHaveBeenCalledTimes(1);
    getSessionMock.mockClear();
    const second = await getValidAccessTokenForEdgeInvoke('categorizeItems');
    expect(second.accessToken).toBe('token-a');
    expect(getSessionMock).not.toHaveBeenCalled();
  });

  it('forces a fresh read after invalidateEdgeInvocationAuthCache', async () => {
    await getValidAccessTokenForEdgeInvoke('categorizeItems');
    getSessionMock.mockClear();
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: 'token-c',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { id: 'user-z' },
        },
      },
      error: null,
    });
    invalidateEdgeInvocationAuthCache();
    const next = await getValidAccessTokenForEdgeInvoke('categorizeItems');
    expect(next.accessToken).toBe('token-c');
    expect(getSessionMock).toHaveBeenCalledTimes(1);
  });
});
