export function normalize(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Coerce API values that may be boolean or string "true"/"false" to boolean. */
export function toBoolean(v: unknown): boolean {
  return v === true || v === 'true';
}
