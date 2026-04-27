/** Convert a `Map` to a plain object for JSON / AsyncStorage persistence. */
export function mapToRecord<K extends string, V>(map: Map<K, V>): Record<string, V> {
  return Object.fromEntries(map) as Record<string, V>;
}
