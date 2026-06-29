/**
 * Normalize user-entered recipe URLs before server fetch (https default, trim whitespace).
 */
export function normalizeRecipeImportUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return trimmed;
    }
    return url.toString();
  } catch {
    return trimmed;
  }
}
