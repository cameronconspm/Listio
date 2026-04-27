/**
 * Title-case each whitespace-delimited token: first letter upper, following letters lower.
 * Tokens with no letters (digits/punctuation only) are left unchanged.
 */
function titleToken(token: string): string {
  if (!/[A-Za-z]/.test(token)) {
    return token;
  }
  const chars = [...token];
  const idx = chars.findIndex((c) => /[A-Za-z]/.test(c));
  if (idx === -1) {
    return token;
  }
  return (
    chars.slice(0, idx).join('') +
    chars[idx].toUpperCase() +
    chars.slice(idx + 1).join('').toLowerCase()
  );
}

export function titleCaseWords(text: string): string {
  const normalized = text.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    return '';
  }
  return normalized.split(' ').map(titleToken).join(' ');
}
