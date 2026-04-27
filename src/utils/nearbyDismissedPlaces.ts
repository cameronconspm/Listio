import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@listio/nearby_dismissed_place_ids';
const MAX_IDS = 250;

export async function getDismissedNearbyPlaceIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === 'string' && x.length > 0));
  } catch {
    return new Set();
  }
}

export async function addDismissedNearbyPlaceId(placeId: string): Promise<void> {
  const next = await getDismissedNearbyPlaceIds();
  next.add(placeId);
  const trimmed = [...next].slice(-MAX_IDS);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore */
  }
}

export async function removeDismissedNearbyPlaceId(placeId: string): Promise<void> {
  const next = await getDismissedNearbyPlaceIds();
  next.delete(placeId);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify([...next]));
  } catch {
    /* ignore */
  }
}
