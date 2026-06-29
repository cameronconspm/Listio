#!/usr/bin/env node
/**
 * Production smoke: legacy list insert (no list_id) via PostgREST, same path as App Store build 85b9ce2.
 * Requires LISTIO_SMOKE_TEST_PASSWORD in env (official test account).
 */
const { createClient } = require('@supabase/supabase-js');

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.LISTIO_SMOKE_TEST_EMAIL ?? 'testuser@thelistioapp.com';
const password = process.env.LISTIO_SMOKE_TEST_PASSWORD;

async function main() {
  if (!url || !anonKey) {
    console.error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
  }
  if (!password) {
    console.log('SKIP api-smoke: LISTIO_SMOKE_TEST_PASSWORD not set');
    process.exit(0);
  }

  const supabase = createClient(url, anonKey);
  const { data: auth, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError || !auth.user) {
    console.error('signIn failed:', signInError?.message ?? 'no user');
    process.exit(1);
  }

  const userId = auth.user.id;
  const { data: householdId, error: hhError } = await supabase.rpc('ensure_user_household');
  if (hhError || !householdId) {
    console.error('ensure_user_household failed:', hhError?.message ?? 'no household');
    process.exit(1);
  }

  const smokeName = `__smoke_api_legacy_${Date.now()}__`;
  const { data: inserted, error: insertError } = await supabase
    .from('list_items')
    .insert({
      user_id: userId,
      household_id: householdId,
      name: smokeName,
      normalized_name: smokeName.toLowerCase(),
      category: 'Produce',
      zone_key: 'produce',
      quantity_value: null,
      quantity_unit: null,
      notes: null,
      is_checked: false,
      linked_meal_ids: [],
    })
    .select('id, list_id, household_id, name')
    .single();

  if (insertError || !inserted) {
    console.error('insert failed:', insertError?.message ?? 'no row');
    process.exit(1);
  }

  const ok =
    Boolean(inserted.id) &&
    Boolean(inserted.list_id) &&
    inserted.household_id === householdId;

  await supabase.from('list_items').delete().eq('id', inserted.id);

  if (!ok) {
    console.error('insert succeeded but validation failed:', inserted);
    process.exit(1);
  }

  console.log('PASS api-smoke: legacy insert without list_id');
  console.log(JSON.stringify({ id: inserted.id, list_id: inserted.list_id }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
