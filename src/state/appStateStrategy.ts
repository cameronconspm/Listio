/**
 * Client state strategy (no global Redux/Zustand module):
 * — Screen/UI state: React useState/useRef and small contexts (theme, onboarding, navigation chrome).
 * — Persistence: services + AsyncStorage / Supabase.
 * — Shared server cache: TanStack Query via `src/query` when hooks are wired.
 *
 * The old placeholder `src/state/store.ts` was removed; nothing imported it.
 */

export {};
