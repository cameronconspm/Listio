function equalHalves(text: string): { first: string; second: string } | null {
  const len = text.length;
  if (len < 2 || len % 2 !== 0) return null;
  const half = len / 2;
  return { first: text.slice(0, half), second: text.slice(half) };
}

function halvesAreDuplicate(first: string, second: string): boolean {
  if (first === second) return true;
  return first.toLowerCase() === second.toLowerCase();
}

/** Collapse `WordWord` when both halves match (optionally case-insensitive). */
function collapseEqualHalves(text: string, minTotalLength: number): string | null {
  const halves = equalHalves(text);
  if (!halves || text.length < minTotalLength) return null;
  if (!halvesAreDuplicate(halves.first, halves.second)) return null;
  return halves.first;
}

/**
 * iOS mic-off dictation can append an autocorrected repeat: `Banana` → `BananaBananas`.
 * Odd-length strings skip equal-half detection, so check prefix + suffix explicitly.
 */
function collapsePrefixSuffixDuplicate(prev: string, next: string): string | null {
  if (!prev || next.length <= prev.length || !next.startsWith(prev)) return null;
  const suffix = next.slice(prev.length);
  if (suffix === prev || suffix === ` ${prev}`) return prev;
  if (suffix.toLowerCase() === prev.toLowerCase()) return prev;
  if (
    suffix.length > prev.length &&
    prev.length >= 3 &&
    suffix.toLowerCase().startsWith(prev.toLowerCase())
  ) {
    return suffix;
  }
  return null;
}

/**
 * Scan a standalone string for inline dictation duplication (no reliable `prev`).
 * Handles `BananaBananas` and `BananasBananas` after mic-off finalization.
 */
function collapseInlineDictationDuplicate(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length < 6) return null;

  const halves = collapseEqualHalves(trimmed, 8);
  if (halves) return halves;

  for (let i = 3; i < trimmed.length; i++) {
    const prefix = trimmed.slice(0, i);
    const suffix = trimmed.slice(i);
    if (!suffix.toLowerCase().startsWith(prefix.toLowerCase())) continue;
    if (suffix === prefix || suffix.toLowerCase() === prefix.toLowerCase()) {
      if (trimmed.length >= 8) return prefix;
      continue;
    }
    if (suffix.length > prefix.length) return suffix;
  }

  return null;
}

function prevRelatesToDictationCollapse(prev: string, collapsed: string, next: string): boolean {
  const p = prev.toLowerCase();
  const c = collapsed.toLowerCase();
  const n = next.toLowerCase();
  return p === c || c.startsWith(p) || p.startsWith(c) || n.startsWith(p);
}

/**
 * iOS voice dictation on controlled TextInputs can emit a final onChangeText that
 * appends the transcript again (e.g. "Bananas" → "BananasBananas"). Autocorrect
 * between events can also produce "Banana" → "BananasBananas" in one shot.
 */
export function normalizeDictationTextInput(prev: string, next: string): string {
  if (prev === next) return next;

  if (next === prev + prev) return prev;
  if (next === `${prev} ${prev}`) return prev;

  if (next.length > prev.length && next.startsWith(prev)) {
    const suffix = next.slice(prev.length);
    if (suffix === prev || suffix === ` ${prev}`) return prev;
  }

  const prefixSuffix = collapsePrefixSuffixDuplicate(prev, next);
  if (prefixSuffix) return prefixSuffix;

  const minLen = prev ? 6 : 8;
  const collapsed = collapseEqualHalves(next, minLen);
  if (collapsed && (!prev || prevRelatesToDictationCollapse(prev, collapsed, next))) {
    return collapsed;
  }

  const inline = collapseInlineDictationDuplicate(next);
  if (inline && (!prev || prevRelatesToDictationCollapse(prev, inline, next))) {
    return inline;
  }

  return next;
}

/**
 * Final pass when dictation ends (blur, mic-off, or delayed finalize).
 */
export function collapseDictationDuplicate(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return text;
  const collapsed = collapseInlineDictationDuplicate(trimmed);
  if (!collapsed) return text;
  return collapsed;
}
