#!/usr/bin/env node
/**
 * Fetches public URLs used for App Store Connect (privacy, terms, support).
 * Keep URL list in sync with src/constants/legalUrls.ts
 *
 * Uses GET (not HEAD): some hosts return errors or flaky behavior for HEAD behind CDNs.
 *
 * App Store Connect (manual): set Privacy Policy, Terms of Use (EULA), and Support URL
 * to these same live pages; add Review Notes with demo credentials if applicable
 * (see src/constants/officialTestAccount.ts — OFFICIAL_LISTIO_TEST_ACCOUNT_EMAIL).
 */
const URLS = [
  { url: 'https://thelistioapp.com/privacy-policy', label: 'Privacy policy' },
  { url: 'https://thelistioapp.com/terms-and-conditions', label: 'Terms of use' },
  { url: 'https://thelistioapp.com/help', label: 'Support / help center' },
];

const UA =
  'Mozilla/5.0 (compatible; ListioCI/1.0; +https://thelistioapp.com) AppleWebKit/537.36 (KHTML, like Gecko)';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchOnce(url) {
  const res = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': UA,
    },
  });
  await res.arrayBuffer().catch(() => {});
  return res.status;
}

async function fetchWithRetries(url, label) {
  const maxAttempts = 3;
  let lastErr = '';
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const code = await fetchOnce(url);
      if (code >= 200 && code < 400) return code;
      lastErr = `HTTP ${code}`;
    } catch (e) {
      lastErr = e?.message ?? String(e);
    }
    if (attempt < maxAttempts) await sleep(800 * attempt);
  }
  throw new Error(`${label}: ${lastErr}`);
}

async function main() {
  let failed = false;
  for (const { url, label } of URLS) {
    try {
      const code = await fetchWithRetries(url, label);
      console.log(`[verify-app-store-legal-urls] OK ${label} (${code})`);
    } catch (e) {
      console.error(`[verify-app-store-legal-urls] ${label}: failed — ${url}`, e?.message ?? e);
      failed = true;
    }
  }
  if (failed) {
    process.exit(1);
  }
}

main();
