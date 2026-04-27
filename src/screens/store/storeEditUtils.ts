export function generateCustomAisleId(): string {
  return `custom_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
