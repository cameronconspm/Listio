/**
 * Automated slice of the TestFlight "backend smoke" checklist: config must embed
 * Supabase for production builds, and the client must treat that as configured.
 */
import appJson from '../app.json';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Jest mock factory; hoisted
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const originalEnv: Record<string, string | undefined> = {};

function stashEnv(keys: string[]) {
  for (const k of keys) {
    originalEnv[k] = process.env[k];
  }
}

function restoreEnv(keys: string[]) {
  for (const k of keys) {
    const v = originalEnv[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

describe('first-launch / EAS config contract', () => {
  const keys = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'];

  afterEach(() => {
    restoreEnv(keys);
    jest.resetModules();
  });

  it('app.config.js merges app.json and Supabase extra from process.env', () => {
    stashEnv(keys);
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://smoke-test.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'smoke-anon-key';

    // eslint-disable-next-line @typescript-eslint/no-require-imports -- app.config.js is CommonJS
    const configure = require('../app.config.js') as (req: {
      config: Record<string, unknown>;
    }) => Record<string, unknown>;

    const expo = appJson.expo as Record<string, unknown>;
    const out = configure({ config: { ...expo } });

    expect(out.extra).toEqual(
      expect.objectContaining({
        supabaseUrl: 'https://smoke-test.supabase.co',
        supabaseAnonKey: 'smoke-anon-key',
      })
    );
    expect(out.name).toBe(expo.name);
    expect(out.slug).toBe(expo.slug);
  });

  it('isSupabaseConfigured is true when EXPO_PUBLIC_* are set', () => {
    stashEnv(keys);
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://smoke-test.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'smoke-anon-key';

    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- reload after env + resetModules
    const supabaseClient = require('../src/services/supabaseClient') as typeof import('../src/services/supabaseClient');
    const { isSupabaseConfigured, isSupabaseSyncRequiredButMisconfigured } = supabaseClient;

    expect(isSupabaseConfigured()).toBe(true);
    expect(isSupabaseSyncRequiredButMisconfigured()).toBe(false);
  });
});
