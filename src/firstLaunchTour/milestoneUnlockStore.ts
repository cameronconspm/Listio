import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@listio/milestone_unlock_v1';

export type MilestoneUnlockState = {
  listAtLeast3: boolean;
  mealSaved: boolean;
  recipeSaved: boolean;
  unlockPaywallPresented: boolean;
};

const DEFAULT_STATE: MilestoneUnlockState = {
  listAtLeast3: false,
  mealSaved: false,
  recipeSaved: false,
  unlockPaywallPresented: false,
};

async function read(): Promise<MilestoneUnlockState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const p = JSON.parse(raw) as Partial<MilestoneUnlockState>;
    return {
      listAtLeast3: p.listAtLeast3 === true,
      mealSaved: p.mealSaved === true,
      recipeSaved: p.recipeSaved === true,
      unlockPaywallPresented: p.unlockPaywallPresented === true,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

async function write(next: MilestoneUnlockState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export async function getMilestoneUnlockState(): Promise<MilestoneUnlockState> {
  return read();
}

/** Call whenever list item count may have changed. */
export async function syncListCountMilestone(listItemCount: number): Promise<MilestoneUnlockState> {
  const prev = await read();
  if (listItemCount >= 3 && !prev.listAtLeast3) {
    const next = { ...prev, listAtLeast3: true };
    await write(next);
    return next;
  }
  return prev;
}

export async function markMealMilestone(): Promise<MilestoneUnlockState> {
  const prev = await read();
  if (prev.mealSaved) return prev;
  const next = { ...prev, mealSaved: true };
  await write(next);
  return next;
}

export async function markRecipeMilestone(): Promise<MilestoneUnlockState> {
  const prev = await read();
  if (prev.recipeSaved) return prev;
  const next = { ...prev, recipeSaved: true };
  await write(next);
  return next;
}

export async function markUnlockPaywallPresented(): Promise<void> {
  const prev = await read();
  await write({ ...prev, unlockPaywallPresented: true });
}

export function allMilestonesMet(s: MilestoneUnlockState): boolean {
  return s.listAtLeast3 && s.mealSaved && s.recipeSaved;
}

/** For tests only. */
export async function resetMilestoneUnlockStateForTests(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
