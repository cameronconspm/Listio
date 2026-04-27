import AsyncStorage from '@react-native-async-storage/async-storage';

const NEAREST_SUGGEST_LAST_POS_KEY = '@listio/nearest_suggest_last_pos';

export type LastEvalPosition = { lat: number; lng: number };

export async function getNearestSuggestLastPos(): Promise<LastEvalPosition | null> {
  try {
    const raw = await AsyncStorage.getItem(NEAREST_SUGGEST_LAST_POS_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as { lat?: unknown; lng?: unknown };
    if (typeof o.lat === 'number' && typeof o.lng === 'number' && !Number.isNaN(o.lat) && !Number.isNaN(o.lng)) {
      return { lat: o.lat, lng: o.lng };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function setNearestSuggestLastPos(lat: number, lng: number): Promise<void> {
  try {
    await AsyncStorage.setItem(NEAREST_SUGGEST_LAST_POS_KEY, JSON.stringify({ lat, lng }));
  } catch {
    /* ignore */
  }
}
