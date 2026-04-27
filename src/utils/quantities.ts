export interface ParsedQuantity {
  value: number | null;
  unit: string | null;
}

export function parseQuantity(text: string): ParsedQuantity {
  const match = text.match(/^(\d+(?:\.\d+)?)\s*(\w+)?/);
  if (!match) return { value: null, unit: null };
  return {
    value: parseFloat(match[1]),
    unit: match[2] ?? null,
  };
}
