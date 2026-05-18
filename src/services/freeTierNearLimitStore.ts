import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FreeTierKind } from './freeTierLimits';

const STORAGE_KEY = '@listio/free_tier_near_limit_toast_v1';

type NearLimitToastState = Partial<Record<FreeTierKind, boolean>>;

async function readState(): Promise<NearLimitToastState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as NearLimitToastState;
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

async function writeState(next: NearLimitToastState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export async function wasNearLimitToastShown(kind: FreeTierKind): Promise<boolean> {
  const state = await readState();
  return state[kind] === true;
}

export async function markNearLimitToastShown(kind: FreeTierKind): Promise<void> {
  const state = await readState();
  await writeState({ ...state, [kind]: true });
}

/** For tests / debug. */
export async function resetFreeTierNearLimitToastState(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
