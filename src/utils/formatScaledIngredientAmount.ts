/**
 * Deterministic display formatting for scaled recipe quantities:
 * fractions, US volume conversion (tsp/tbsp/cup), mass (g/kg, oz/lb), and count-like rounding.
 */

const TSP_PER_TBSP = 3;
const TSP_PER_CUP = 48;
const TBSP_PER_CUP = 16;
const ML_PER_L = 1000;
const G_PER_KG = 1000;
const OZ_PER_LB = 16;

const UNICODE_FRAC: Record<string, { u: string; a: string }> = {
  '1/8': { u: '⅛', a: '1/8' },
  '1/4': { u: '¼', a: '1/4' },
  '3/8': { u: '⅜', a: '3/8' },
  '1/3': { u: '⅓', a: '1/3' },
  '1/2': { u: '½', a: '1/2' },
  '5/8': { u: '⅝', a: '5/8' },
  '2/3': { u: '⅔', a: '2/3' },
  '3/4': { u: '¾', a: '3/4' },
  '7/8': { u: '⅞', a: '7/8' },
};

/** Kitchen-friendly fractional parts (excluding 0 and 1). */
const KITCHEN_FRAC_SNAPS = [
  1 / 8, 1 / 4, 1 / 3, 3 / 8, 1 / 2, 5 / 8, 2 / 3, 3 / 4, 7 / 8,
];

function snapFractionalPart(frac: number): number {
  if (frac < 1e-6) return 0;
  if (frac > 1 - 1e-6) return 1;
  let best = Math.round(frac * 8) / 8;
  let bestErr = Math.abs(frac - best);
  for (const c of KITCHEN_FRAC_SNAPS) {
    const e = Math.abs(frac - c);
    if (e < bestErr - 1e-9) {
      bestErr = e;
      best = c;
    }
  }
  if (bestErr > 0.12) {
    best = Math.round(frac * 8) / 8;
  }
  return best;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

/** Reduce n/d and return readable string (prefer Unicode for common kitchen fractions). */
function fractionString(n: number, d: number, useUnicode: boolean): string {
  const g = gcd(n, d);
  const rn = n / g;
  const rd = d / g;
  if (rn === 0) return '';
  if (rd === 1) return String(rn);
  const key = `${rn}/${rd}`;
  const hit = UNICODE_FRAC[key];
  if (hit) return useUnicode ? hit.u : hit.a;
  return `${rn}/${rd}`;
}

/**
 * Express `value` as whole + kitchen fraction (⅓, ½, ⅛, etc.).
 */
function formatMixedOrFraction(value: number, _maxDen = 8, useUnicode = true): string {
  if (!Number.isFinite(value) || value < 0) return '0';
  if (value < 1e-9) return '0';
  const whole = Math.floor(value + 1e-9);
  let frac = value - whole;
  if (frac < 1e-6) return whole > 0 ? String(whole) : formatFractionSmall(value, useUnicode);

  const snapped = snapFractionalPart(frac);
  if (snapped < 1e-6) return whole > 0 ? String(whole) : formatFractionSmall(value, useUnicode);
  if (Math.abs(snapped - 1) < 1e-6) {
    return String(whole + 1);
  }

  const num = Math.round(snapped * 96);
  const den = 96;
  const g = gcd(num, den);
  const n = num / g;
  const d = den / g;
  if (whole === 0) {
    return fractionString(n, d, useUnicode);
  }
  const fracPart = fractionString(n, d, useUnicode);
  return fracPart ? `${whole} ${fracPart}` : String(whole);
}

function formatFractionSmall(value: number, useUnicode: boolean): string {
  const snapped = snapFractionalPart(value);
  if (snapped < 1e-6) return '0';
  const num = Math.round(snapped * 96);
  const den = 96;
  const g = gcd(num, den);
  return fractionString(num / g, den / g, useUnicode);
}

export function normalizeIngredientUnit(raw: string): string {
  const x = raw.trim().toLowerCase();
  const map: Record<string, string> = {
    tablespoon: 'tbsp',
    tablespoons: 'tbsp',
    tbs: 'tbsp',
    tbl: 'tbsp',
    tablespoonful: 'tbsp',
    teaspoon: 'tsp',
    teaspoons: 'tsp',
    cups: 'cup',
    gram: 'g',
    grams: 'g',
    kilogram: 'kg',
    kilograms: 'kg',
    pound: 'lb',
    pounds: 'lb',
    lbs: 'lb',
    ounce: 'oz',
    ounces: 'oz',
    milliliter: 'ml',
    milliliters: 'ml',
    millilitre: 'ml',
    millilitres: 'ml',
    liter: 'L',
    liters: 'L',
    litre: 'L',
    litres: 'L',
    each: 'ea',
    piece: 'ea',
    pieces: 'ea',
    clove: 'clove',
    cloves: 'clove',
    l: 'L',
  };
  return map[x] ?? x;
}

const COUNT_LIKE = new Set(['ea', 'count', 'clove', 'bunch', 'jar']);

function isCountLikeUnit(unit: string): boolean {
  return COUNT_LIKE.has(unit);
}

/** Name hints for count-only rounding (eggs, cloves). */
function isEggLikeName(name: string): boolean {
  return /\begg(s)?\b/i.test(name);
}

function roundCountLike(value: number, unit: string, ingredientName: string): number {
  const v = value;
  if (unit === 'clove' || /\bclove\b/i.test(ingredientName)) {
    return Math.max(0, Math.round(v * 2) / 2);
  }
  if (isEggLikeName(ingredientName)) {
    return Math.max(0, Math.round(v));
  }
  if (v >= 12) return Math.round(v);
  if (v >= 1) return Math.round(v * 2) / 2;
  return Math.round(v * 4) / 4;
}

function plural(unit: string, amount: number): string {
  const n = amount;
  if (unit === 'cup' && n !== 1) return 'cups';
  if (unit === 'tbsp') return 'tbsp';
  if (unit === 'tsp') return 'tsp';
  if (unit === 'oz') return 'oz';
  if (unit === 'lb') return n === 1 ? 'lb' : 'lbs';
  if (unit === 'g') return 'g';
  if (unit === 'kg') return 'kg';
  if (unit === 'ml') return 'ml';
  if (unit === 'L') return 'L';
  if (unit === 'clove') return n === 1 ? 'clove' : 'cloves';
  if (unit === 'bunch') return n === 1 ? 'bunch' : 'bunches';
  if (unit === 'ea' || unit === 'count') return '';
  return unit;
}

/** Convert quantity in `unit` to US tsp. */
function volumeToTsp(quantity: number, unit: string): number {
  switch (unit) {
    case 'tsp':
      return quantity;
    case 'tbsp':
      return quantity * TSP_PER_TBSP;
    case 'cup':
      return quantity * TSP_PER_CUP;
    default:
      return quantity;
  }
}

/** Format total tsp as cup / tbsp / tsp with fractions. */
function formatUsVolumeFromTsp(totalTsp: number): string {
  if (totalTsp < 0.0625) return 'pinch';
  let t = Math.round(totalTsp * 8) / 8;
  const cups = Math.floor(t / TSP_PER_CUP);
  t -= cups * TSP_PER_CUP;
  const tbsp = Math.floor(t / TSP_PER_TBSP);
  t -= tbsp * TSP_PER_TBSP;
  const tsp = t;

  const parts: string[] = [];
  if (cups > 0) {
    const cLabel = cups === 1 ? 'cup' : 'cups';
    parts.push(`${formatMixedOrFraction(cups, 8)} ${cLabel}`.trim());
  }
  if (tbsp > 0) {
    const tb = formatMixedOrFraction(tbsp, 8);
    parts.push(`${tb} tbsp`.trim());
  }
  if (tsp > 0.0625) {
    const ts = formatMixedOrFraction(tsp, 8);
    parts.push(`${ts} tsp`.trim());
  }
  if (parts.length === 0 && cups === 0 && tbsp === 0) {
    return `${formatMixedOrFraction(totalTsp, 8)} tsp`;
  }
  return parts.join(' + ');
}

function formatVolumeInOriginalUnit(value: number, unit: string): string {
  const u = unit;
  if (u === 'tsp' || u === 'tbsp' || u === 'cup') {
    const tsp = volumeToTsp(value, u);
    if (u === 'cup' && value < 0.25) {
      return formatUsVolumeFromTsp(tsp);
    }
    if (u === 'tbsp' && value >= TBSP_PER_CUP) {
      return formatUsVolumeFromTsp(tsp);
    }
    if (u === 'tsp' && tsp >= TSP_PER_CUP) {
      return formatUsVolumeFromTsp(tsp);
    }
    if (u === 'tsp' && tsp >= TSP_PER_TBSP && tsp < TSP_PER_CUP) {
      return formatUsVolumeFromTsp(tsp);
    }
    const label = plural(u, value);
    return `${formatMixedOrFraction(value, 8)} ${label}`.trim();
  }
  return `${formatNumberSmart(value)} ${u}`;
}

function formatNumberSmart(n: number): string {
  if (Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n));
  if (n >= 100) return String(Math.round(n));
  if (n >= 10) return n.toFixed(1).replace(/\.0$/, '');
  return formatMixedOrFraction(n, 8);
}

function formatMassG(g: number): string {
  const rounded = g >= 100 ? Math.round(g) : Math.round(g * 10) / 10;
  if (rounded >= G_PER_KG) {
    const kg = rounded / G_PER_KG;
    return `${formatMixedOrFraction(kg, 8)} kg`.trim();
  }
  return `${Math.round(rounded)} g`;
}

function formatMassLbOz(oz: number): string {
  if (oz >= OZ_PER_LB) {
    const lb = Math.floor(oz / OZ_PER_LB);
    const rem = oz - lb * OZ_PER_LB;
    if (rem < 0.1) return `${lb} ${lb === 1 ? 'lb' : 'lbs'}`;
    return `${lb} ${lb === 1 ? 'lb' : 'lbs'} ${formatMixedOrFraction(rem, 8)} oz`.trim();
  }
  return `${formatMixedOrFraction(oz, 8)} oz`.trim();
}

function formatMass(value: number, unit: string): string {
  const u = unit;
  if (u === 'g' || u === 'kg') {
    const g = u === 'kg' ? value * G_PER_KG : value;
    return formatMassG(g);
  }
  if (u === 'oz' || u === 'lb') {
    const oz = u === 'lb' ? value * OZ_PER_LB : value;
    return formatMassLbOz(oz);
  }
  return `${formatNumberSmart(value)} ${u}`;
}

function formatMlMl(value: number, unit: string): string {
  if (unit === 'L') {
    const ml = value * ML_PER_L;
    return ml >= ML_PER_L ? `${formatMixedOrFraction(value, 8)} L`.trim() : `${Math.round(ml)} ml`;
  }
  if (value >= ML_PER_L) {
    const L = value / ML_PER_L;
    return `${formatMixedOrFraction(L, 8)} L`.trim();
  }
  return `${Math.round(value)} ml`;
}

/**
 * Format a scaled ingredient amount for UI (deterministic, no AI).
 */
export function formatScaledIngredientQuantityDisplay(
  quantityValue: number,
  quantityUnitRaw: string,
  ingredientName = ''
): string {
  if (!Number.isFinite(quantityValue) || quantityValue < 0) return '';
  const unit = normalizeIngredientUnit(quantityUnitRaw);
  if (!unit) return formatNumberSmart(quantityValue);

  if (isCountLikeUnit(unit)) {
    const rounded = roundCountLike(quantityValue, unit, ingredientName);
    const u = unit === 'ea' || unit === 'count' ? '' : plural(unit, rounded);
    const num = formatMixedOrFraction(rounded, 4);
    return u ? `${num} ${u}`.trim() : num;
  }

  if (unit === 'tsp' || unit === 'tbsp' || unit === 'cup') {
    return formatVolumeInOriginalUnit(quantityValue, unit);
  }

  if (unit === 'g' || unit === 'kg' || unit === 'oz' || unit === 'lb') {
    return formatMass(quantityValue, unit);
  }

  if (unit === 'ml' || unit === 'L') {
    return formatMlMl(quantityValue, unit);
  }

  return `${formatNumberSmart(quantityValue)} ${unit}`.trim();
}
