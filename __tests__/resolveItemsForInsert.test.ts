import { FunctionsHttpError } from '@supabase/supabase-js';
import { resolveCommonGroceryCategory } from '../src/services/commonGroceryCatalog';
import { categorizeItems, clearCategorizeInflight, AiRateLimitError } from '../src/services/aiService';
import { clearAiQuotaPause, markAiQuotaRateLimited, isAiQuotaPaused } from '../src/services/aiQuotaSession';
import {
  resolveItemsForInsert,
  categorizeFallbackToastMessage,
} from '../src/services/resolveItemsForInsert';
import { showInfo } from '../src/utils/appToast';

jest.mock('../src/services/supabaseClient', () => ({
  supabase: {
    functions: { invoke: jest.fn() },
    auth: {
      getSession: jest.fn(async () => ({
        data: {
          session: {
            access_token: 'tok',
            expires_at: 9999999999,
            user: { id: 'user-1' },
          },
        },
      })),
      refreshSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
  },
  isSyncEnabled: () => true,
  isSupabaseConfigured: () => true,
  signOutLocallyIfCorruptRefreshToken: jest.fn(),
}));

jest.mock('../src/services/edgeInvocationAuth', () => ({
  getValidAccessTokenForEdgeInvoke: jest.fn(async () => ({ accessToken: 'tok' })),
  invalidateEdgeInvocationAuthCache: jest.fn(),
}));

jest.mock('../src/utils/appToast', () => ({
  showInfo: jest.fn(),
  showError: jest.fn(),
}));

const { supabase } = jest.requireMock('../src/services/supabaseClient') as {
  supabase: { functions: { invoke: jest.Mock } };
};

describe('resolveItemsForInsert', () => {
  beforeEach(() => {
    clearCategorizeInflight();
    clearAiQuotaPause();
    supabase.functions.invoke.mockReset();
  });

  it('returns local catalog on rate limit without blocking insert', async () => {
    const rateLimitedResponse = new Response(
      JSON.stringify({ error: 'Too many requests', code: 'rate_limited' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(rateLimitedResponse),
    });

    const uncached = 'zz obscure uncached token xyz789';
    const res = await resolveItemsForInsert([uncached], { storeType: 'generic' });
    expect(res.didFallback).toBe(true);
    expect(res.fallbackReason).toBe('rate_limited');
    expect(res.results[0]?.zone_key).toBe('other');
    expect(showInfo).toHaveBeenCalled();
  });

  it('resolves catalog hits locally without edge when categorize is not needed', async () => {
    const res = await resolveItemsForInsert(['olives'], {
      storeType: 'generic',
      showFallbackToast: false,
    });
    expect(res.didFallback).toBe(false);
    expect(res.results[0]?.zone_key).toBe('pantry');
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('uses manual zone override without edge call', async () => {
    const res = await resolveItemsForInsert(['mystery item'], {
      zoneOverride: 'frozen',
      showFallbackToast: false,
    });
    expect(res.didFallback).toBe(false);
    expect(res.results[0]?.zone_key).toBe('frozen');
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('falls back to other for unknown items on generic error', async () => {
    supabase.functions.invoke.mockRejectedValue(new Error('network down'));

    const res = await resolveItemsForInsert(['zz obscure uncached token xyz'], {
      showFallbackToast: false,
    });
    expect(res.didFallback).toBe(true);
    expect(res.fallbackReason).toBe('error');
    expect(res.results[0]?.zone_key).toBe('other');
  });
});

describe('categorizeFallbackToastMessage', () => {
  it('uses distinct copy for rate limit vs generic error', () => {
    expect(categorizeFallbackToastMessage('rate_limited')).toMatch(/briefly paused/i);
    expect(categorizeFallbackToastMessage('error')).toMatch(/couldn't sort/i);
  });
});

describe('aiQuotaSession', () => {
  beforeEach(() => clearAiQuotaPause());

  it('pauses background calls after markAiQuotaRateLimited', () => {
    expect(isAiQuotaPaused()).toBe(false);
    markAiQuotaRateLimited();
    expect(isAiQuotaPaused()).toBe(true);
  });
});

describe('categorizeItems callKind', () => {
  beforeEach(() => {
    clearCategorizeInflight();
    supabase.functions.invoke.mockReset();
    supabase.functions.invoke.mockResolvedValue({
      data: {
        results: [
          {
            input: 'dragon fruit',
            normalized_name: 'dragon fruit',
            category: 'Produce',
            zone_key: 'produce',
            confidence: 0.9,
          },
        ],
        source_counts: { openai: 1 },
      },
      error: null,
    });
  });

  it('forwards callKind in invoke body', async () => {
    await categorizeItems(['dragon fruit'], 'generic', ['Produce'], { callKind: 'background' });
    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      'categorize-items',
      expect.objectContaining({
        body: expect.objectContaining({ callKind: 'background' }),
      })
    );
  });

  it('throws AiRateLimitError on 429 after retry', async () => {
    const rateLimitedResponse = new Response(
      JSON.stringify({ error: 'Too many requests', code: 'rate_limited' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(rateLimitedResponse),
    });
    await expect(
      categorizeItems(['zz obscure uncached token xyz789'], 'generic', [])
    ).rejects.toBeInstanceOf(AiRateLimitError);
  });
});

describe('catalog olives', () => {
  it('resolves olives to pantry without AI', () => {
    const hit = resolveCommonGroceryCategory('Olives');
    expect(hit).not.toBeNull();
    expect(hit!.zone_key).toBe('pantry');
  });
});
