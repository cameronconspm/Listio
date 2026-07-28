/** Client-side pause for low-priority AI calls after a 429 rate limit. */

const PAUSE_MS = 15 * 60 * 1000;

let pausedUntilMs = 0;

export function markAiQuotaRateLimited(): void {
  pausedUntilMs = Date.now() + PAUSE_MS;
}

export function isAiQuotaPaused(): boolean {
  return Date.now() < pausedUntilMs;
}

/** Clears pause state (tests). */
export function clearAiQuotaPause(): void {
  pausedUntilMs = 0;
}
