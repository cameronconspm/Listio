/**
 * Split freeform instructions into display steps (non-empty lines).
 */
export function parseRecipeInstructionSteps(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
