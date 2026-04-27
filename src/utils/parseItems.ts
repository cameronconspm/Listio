import { UNIT_PATTERN } from '../data/units';

export function parseItems(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface ParsedItem {
  name: string;
  quantity: number;
  unit: string;
  note?: string;
  /** Optional metadata for single-item add/edit (bulk add uses defaults) */
  brand_preference?: string | null;
  substitute_allowed?: boolean;
  priority?: 'low' | 'normal' | 'high';
  is_recurring?: boolean;
}

const QTY_UNIT_REGEX = new RegExp(
  `(\\d+(?:\\.\\d+)?)\\s*(${UNIT_PATTERN})\\b`,
  'gi'
);
const X_QTY_REGEX = /\s*x\s*(\d+)\b/i;
const LEADING_NUMBER_REGEX = /^(\d+(?:\.\d+)?)\s+(.+)$/;
const TRAILING_NUMBER_REGEX = /\s+(\d+(?:\.\d+)?)$/;

/**
 * Parse a single natural string like "milk", "bananas x6", "chicken thighs 2 lb", "2 avocados"
 * into { name, quantity, unit }.
 */
export function parseSingleEntry(text: string): ParsedItem {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (!trimmed) return { name: '', quantity: 1, unit: 'ea' };

  let name = trimmed;
  let quantity = 1;
  let unit = 'ea';

  // Check for xN pattern (e.g. "bananas x6")
  const xMatch = name.match(X_QTY_REGEX);
  if (xMatch) {
    quantity = parseInt(xMatch[1], 10);
    name = name.replace(X_QTY_REGEX, '').trim();
  }

  // Check for number + unit (e.g. "chicken thighs 2 lb", "2 lb chicken")
  const qtyUnitMatch = name.match(QTY_UNIT_REGEX);
  if (qtyUnitMatch) {
    const lastMatch = qtyUnitMatch[qtyUnitMatch.length - 1];
    const parts = lastMatch.match(/(\d+(?:\.\d+)?)\s*(\w+)/i);
    if (parts) {
      quantity = parseFloat(parts[1]);
      unit = parts[2].toLowerCase();
      name = name.replace(QTY_UNIT_REGEX, '').replace(/\s+/g, ' ').trim();
    }
  }

  // Check for leading number without unit (e.g. "2 avocados")
  if (!qtyUnitMatch && !xMatch) {
    const leadingMatch = name.match(LEADING_NUMBER_REGEX);
    if (leadingMatch) {
      quantity = parseFloat(leadingMatch[1]);
      name = leadingMatch[2].trim();
    } else {
      // Check for trailing number (e.g. "bread 1")
      const trailingMatch = name.match(TRAILING_NUMBER_REGEX);
      if (trailingMatch) {
        quantity = parseFloat(trailingMatch[1]);
        name = name.replace(TRAILING_NUMBER_REGEX, '').trim();
      }
    }
  }

  name = name.replace(/^[,.\s]+|[,.\s]+$/g, '').trim() || 'item';

  return { name, quantity, unit };
}

/**
 * Parse bulk text (newline/comma-separated) into ParsedItem[].
 */
export function parseBulkToItems(text: string): ParsedItem[] {
  const raw = parseItems(text);
  return raw.map(parseSingleEntry).filter((p) => p.name && p.name !== 'item');
}
