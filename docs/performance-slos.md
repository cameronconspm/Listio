# Listio performance SLOs

Targets are **p95** unless noted. Instrumentation lives in `src/utils/perf.ts` (sampled Sentry spans in release when `EXPO_PUBLIC_SENTRY_PERF_SAMPLE_RATE` is set).

| Metric | Target | Instrument |
|--------|--------|------------|
| Cold start → Home interactive | < 3s (iPhone 12+) | Sentry transaction `app.cold_start` |
| Home list fetch | < 1.5s | `timeAsync('fetchHomeListBundle')` |
| Categorize (cache miss) | < 2s | `timeAsync('categorizeItems')` |
| Recipe URL import | < 15s | Recipe import overlay phases |
| `deriveHomeListModel` (500 items) | < 50ms | Jest benchmark in `__tests__/homeScreenListDerived.test.ts` |

## Feature flags

| Flag | Purpose |
|------|---------|
| `EXPO_PUBLIC_ZONE_INNER_VIRTUALIZE` | Reserved; zone inner list uses threshold 20 items by default |
| `EXPO_PUBLIC_LIST_REALTIME` | `1` enables Supabase Realtime invalidation on Home |
| `EXPO_PUBLIC_OFFLINE_MUTATION_QUEUE` | `1` enables offline mutation queue storage (replay TBD) |

## Pre-release

Run `npm run verify:pre-release` and complete the manual device checklist appended by that script.
