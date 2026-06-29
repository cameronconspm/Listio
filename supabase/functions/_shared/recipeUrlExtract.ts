/**
 * Recipe extraction helpers for URL import: JSON-LD (schema.org/Recipe) first,
 * then plain HTML text. Used by parse-recipe edge function.
 */

const JSON_LD_SCRIPT_RE = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

export type ExtractedRecipeDraft = {
  name: string | null;
  servings: number | null;
  total_time_minutes: number | null;
  category: null;
  instructions: string | null;
  notes: string | null;
  recipe_url: string | null;
  ingredients: {
    name: string | null;
    quantity_value: number | null;
    quantity_unit: string | null;
    notes: string | null;
  }[];
};

function decodeBasicHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = parseInt(n, 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
    });
}

function stripHtmlTags(input: string): string {
  return decodeBasicHtmlEntities(input.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function isRecipeType(type: unknown): boolean {
  const types = Array.isArray(type) ? type : type != null ? [type] : [];
  return types.some((t) => typeof t === 'string' && /recipe/i.test(t));
}

function collectJsonLdRecipeNodes(node: unknown, out: Record<string, unknown>[]): void {
  if (node == null) return;
  if (Array.isArray(node)) {
    for (const item of node) collectJsonLdRecipeNodes(item, out);
    return;
  }
  if (typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;
  if (isRecipeType(obj['@type'])) out.push(obj);
  if (obj['@graph']) collectJsonLdRecipeNodes(obj['@graph'], out);
}

export function extractJsonLdRecipeNodes(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  JSON_LD_SCRIPT_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = JSON_LD_SCRIPT_RE.exec(html)) !== null) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      collectJsonLdRecipeNodes(JSON.parse(raw), out);
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  }
  return out;
}

function iso8601DurationToMinutes(input: unknown): number | null {
  if (typeof input !== 'string' || !input.trim()) return null;
  const value = input.trim().toUpperCase();
  const match =
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value) ??
    /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value);
  if (!match) return null;
  const days = parseInt(match[1] ?? '0', 10);
  const hours = parseInt(match[2] ?? '0', 10);
  const minutes = parseInt(match[3] ?? '0', 10);
  const seconds = parseInt(match[4] ?? '0', 10);
  const total = days * 24 * 60 + hours * 60 + minutes + Math.ceil(seconds / 60);
  return total > 0 && total <= 10080 ? total : null;
}

function pickBestDurationMinutes(recipe: Record<string, unknown>): number | null {
  const candidates = [recipe.totalTime, recipe.cookTime, recipe.prepTime, recipe.performTime];
  let best: number | null = null;
  for (const c of candidates) {
    const mins = iso8601DurationToMinutes(c);
    if (mins == null) continue;
    best = best == null ? mins : Math.max(best, mins);
  }
  return best;
}

function stringFromUnknown(input: unknown): string | null {
  if (input == null) return null;
  if (typeof input === 'string') {
    const trimmed = stripHtmlTags(input);
    return trimmed || null;
  }
  if (typeof input === 'number' && Number.isFinite(input)) return String(input);
  if (typeof input === 'object' && input !== null) {
    const o = input as Record<string, unknown>;
    if (typeof o.text === 'string') return stripHtmlTags(o.text) || null;
    if (typeof o.name === 'string') return stripHtmlTags(o.name) || null;
    if (typeof o.value === 'string') return stripHtmlTags(o.value) || null;
  }
  return null;
}

function parseYieldToServings(input: unknown): number | null {
  if (typeof input === 'number' && Number.isFinite(input)) {
    const n = Math.floor(input);
    return n > 0 && n <= 1000 ? n : null;
  }
  const text = stringFromUnknown(input);
  if (!text) return null;
  const match = /(\d+(?:\.\d+)?)/.exec(text);
  if (!match) return null;
  const n = Math.floor(parseFloat(match[1]));
  return n > 0 && n <= 1000 ? n : null;
}

function flattenInstructions(input: unknown): string | null {
  if (input == null) return null;
  if (typeof input === 'string') {
    const trimmed = input.replace(/\r\n/g, '\n').trim();
    return trimmed || null;
  }
  if (!Array.isArray(input)) {
    const single = stringFromUnknown(input);
    return single;
  }
  const lines: string[] = [];
  for (const item of input) {
    if (typeof item === 'string') {
      const line = item.trim();
      if (line) lines.push(line);
      continue;
    }
    if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>;
      if (Array.isArray(o.itemListElement)) {
        const nested = flattenInstructions(o.itemListElement);
        if (nested) lines.push(...nested.split('\n').filter(Boolean));
        continue;
      }
      const text = stringFromUnknown(item);
      if (text) lines.push(text);
    }
  }
  if (!lines.length) return null;
  return lines.map((line, idx) => `${idx + 1}. ${line.replace(/^\d+[\.)]\s*/, '')}`).join('\n');
}

function parseIngredientLine(raw: string): ExtractedRecipeDraft['ingredients'][number] {
  const line = raw.trim();
  if (!line) return { name: null, quantity_value: null, quantity_unit: null, notes: null };
  return { name: line, quantity_value: null, quantity_unit: null, notes: null };
}

function parseIngredients(input: unknown): ExtractedRecipeDraft['ingredients'] {
  if (input == null) return [];
  const rows = Array.isArray(input) ? input : [input];
  const out: ExtractedRecipeDraft['ingredients'] = [];
  for (const row of rows) {
    const text = stringFromUnknown(row);
    if (!text) continue;
    out.push(parseIngredientLine(text));
    if (out.length >= 150) break;
  }
  return out.filter((row) => Boolean(row.name));
}

function scoreJsonLdRecipe(recipe: Record<string, unknown>): number {
  const name = stringFromUnknown(recipe.name) ?? stringFromUnknown(recipe.headline);
  const ingredients = parseIngredients(recipe.recipeIngredient);
  const instructions = flattenInstructions(recipe.recipeInstructions);
  let score = 0;
  if (name) score += 2;
  score += Math.min(ingredients.length, 10);
  if (instructions) score += Math.min(instructions.length / 40, 8);
  return score;
}

export function jsonLdRecipeToDraft(
  recipe: Record<string, unknown>,
  sourceUrl: string | null
): ExtractedRecipeDraft {
  const name = stringFromUnknown(recipe.name) ?? stringFromUnknown(recipe.headline);
  const ingredients = parseIngredients(recipe.recipeIngredient);
  const instructions = flattenInstructions(recipe.recipeInstructions);
  const notes = stringFromUnknown(recipe.description);
  const recipeUrl = stringFromUnknown(recipe.url) ?? sourceUrl;
  return {
    name,
    servings: parseYieldToServings(recipe.recipeYield),
    total_time_minutes: pickBestDurationMinutes(recipe),
    category: null,
    instructions,
    notes: notes && notes !== name ? notes : null,
    recipe_url: recipeUrl,
    ingredients,
  };
}

export function extractBestJsonLdRecipeDraft(
  html: string,
  sourceUrl: string | null
): ExtractedRecipeDraft | null {
  const nodes = extractJsonLdRecipeNodes(html);
  if (!nodes.length) return null;
  let best: ExtractedRecipeDraft | null = null;
  let bestScore = 0;
  for (const node of nodes) {
    const score = scoreJsonLdRecipe(node);
    if (score <= bestScore) continue;
    const draft = jsonLdRecipeToDraft(node, sourceUrl);
    const hasCore = Boolean(draft.name && (draft.ingredients.length > 0 || draft.instructions));
    if (!hasCore) continue;
    best = draft;
    bestScore = score;
  }
  return best;
}

export function recipeDraftToPlainText(draft: ExtractedRecipeDraft): string {
  const parts: string[] = [];
  if (draft.name) parts.push(draft.name);
  if (draft.servings != null) parts.push(`Servings: ${draft.servings}`);
  if (draft.total_time_minutes != null) parts.push(`Total time: ${draft.total_time_minutes} minutes`);
  if (draft.ingredients.length) {
    parts.push('', 'Ingredients:');
    for (const ing of draft.ingredients) {
      if (ing.name) parts.push(`- ${ing.name}`);
    }
  }
  if (draft.instructions) {
    parts.push('', 'Instructions:', draft.instructions);
  }
  if (draft.notes) {
    parts.push('', 'Notes:', draft.notes);
  }
  return parts.join('\n').trim();
}

export function isRecipeDraftUsable(draft: ExtractedRecipeDraft): boolean {
  return Boolean(draft.name && (draft.ingredients.length > 0 || draft.instructions));
}

const JS_ONLY_PAGE_RE =
  /\b(enable javascript|javascript (?:is )?required|please enable js|browser does not support javascript)\b/i;
const PAYWALL_RE = /\b(subscribe to (?:read|continue|unlock)|sign in to (?:view|read)|members only)\b/i;

/** Returns a user-facing hint when fetched HTML looks like a stub, not a recipe page. */
export function detectLikelyUnusablePageText(plain: string): string | null {
  const sample = plain.slice(0, 4000);
  if (plain.length < 120 && JS_ONLY_PAGE_RE.test(sample)) {
    return 'That page needs a browser to load the recipe. Copy the recipe text and use Paste recipe instead.';
  }
  if (plain.length < 200 && PAYWALL_RE.test(sample)) {
    return 'That recipe may be behind a paywall. Copy the recipe text from the site and use Paste recipe instead.';
  }
  return null;
}

export function normalizePastedRecipeText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
