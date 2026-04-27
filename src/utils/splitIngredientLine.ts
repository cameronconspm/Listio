/**
 * When AI returns a single string like "280g bread flour" with no qty/unit fields,
 * split into quantity, unit, and ingredient name for the recipe form.
 */
export function splitCompoundIngredientLine(raw: string): {
  name: string;
  quantity_value: number | null;
  quantity_unit: string | null;
  notes: string | null;
} {
  const original = raw.trim();
  if (!original) {
    return { name: '', quantity_value: null, quantity_unit: null, notes: null };
  }

  let notes: string | null = null;
  let rest = original;
  const paren = /\(([^)]+)\)\s*$/.exec(rest);
  if (paren) {
    notes = paren[1].trim();
    rest = rest.slice(0, paren.index).trim();
  }

  // "280g bread flour" or "280 g bread flour"
  const glued = /^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)\s+(.+)$/.exec(rest);
  if (glued) {
    const qty = parseFloat(glued[1]);
    const unit = glued[2];
    const nameRest = glued[3].trim();
    if (Number.isFinite(qty) && unit.length <= 12 && nameRest.length > 0) {
      return { name: nameRest, quantity_value: qty, quantity_unit: unit, notes };
    }
  }

  // "1/2 cup milk" or "2 cups flour"
  const frac = /^(\d+\/\d+)\s+(cup|cups|tbsp|tsp|tbs|oz|lb|lbs|g|kg|ml|l)\s+(.+)$/i.exec(rest);
  if (frac) {
    const [a, b] = frac[1].split('/').map((x) => parseInt(x, 10));
    if (b && b !== 0) {
      const qty = a / b;
      return {
        name: frac[3].trim(),
        quantity_value: qty,
        quantity_unit: frac[2].toLowerCase(),
        notes,
      };
    }
  }

  const spaced = /^(\d+(?:\.\d+)?)\s+(cup|cups|tbsp|tsp|tbs|oz|lb|lbs|g|kg|ml|l)\s+(.+)$/i.exec(rest);
  if (spaced) {
    const qty = parseFloat(spaced[1]);
    if (Number.isFinite(qty)) {
      return {
        name: spaced[3].trim(),
        quantity_value: qty,
        quantity_unit: spaced[2].toLowerCase(),
        notes,
      };
    }
  }

  // "2 eggs"
  const countOnly = /^(\d+(?:\.\d+)?)\s+(.+)$/.exec(rest);
  if (countOnly) {
    const qty = parseFloat(countOnly[1]);
    const nameRest = countOnly[2].trim();
    if (Number.isFinite(qty) && qty < 500 && nameRest.length > 0 && /^(egg|eggs|clove|cloves)\b/i.test(nameRest)) {
      return { name: nameRest, quantity_value: qty, quantity_unit: 'ea', notes };
    }
  }

  return { name: original, quantity_value: null, quantity_unit: null, notes };
}
