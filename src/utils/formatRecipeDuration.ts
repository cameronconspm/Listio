/**
 * Human-readable duration for recipe total time pills (minutes).
 */
export function formatRecipeDurationMinutes(totalMinutes: number | null | undefined): string | null {
  if (totalMinutes == null || Number.isNaN(totalMinutes) || totalMinutes <= 0) {
    return null;
  }
  const m = Math.round(totalMinutes);
  if (m < 60) {
    return `${m} min`;
  }
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (rem === 0) {
    return h === 1 ? '1 hr' : `${h} hr`;
  }
  return `${h} hr ${rem} min`;
}
