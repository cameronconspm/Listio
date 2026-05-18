/** Runs before test files load so supabaseClient createClient() has a URL. */
process.env.EXPO_PUBLIC_SUPABASE_URL ??= 'https://jest-test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??= 'jest-anon-key';
