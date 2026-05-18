import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@listio/engagement_paywall_v1';

export type EngagementPaywallState = {
  meaningfulActionCount: number;
  softPaywallPresented: boolean;
};

const DEFAULT_STATE: EngagementPaywallState = {
  meaningfulActionCount: 0,
  softPaywallPresented: false,
};

export const MEANINGFUL_ACTIONS_THRESHOLD = 3;

async function readState(): Promise<EngagementPaywallState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as Partial<EngagementPaywallState>;
    return {
      meaningfulActionCount:
        typeof parsed.meaningfulActionCount === 'number' ? Math.max(0, parsed.meaningfulActionCount) : 0,
      softPaywallPresented: parsed.softPaywallPresented === true,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

async function writeState(next: EngagementPaywallState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

/** +1 per successful meaningful action; returns whether to offer the one-time soft paywall. */
export async function incrementMeaningfulAction(): Promise<{
  shouldOfferSoftPaywall: boolean;
  state: EngagementPaywallState;
}> {
  const prev = await readState();
  if (prev.softPaywallPresented) {
    return { shouldOfferSoftPaywall: false, state: prev };
  }
  const meaningfulActionCount = prev.meaningfulActionCount + 1;
  const next: EngagementPaywallState = { ...prev, meaningfulActionCount };
  await writeState(next);
  const shouldOfferSoftPaywall = meaningfulActionCount >= MEANINGFUL_ACTIONS_THRESHOLD;
  return { shouldOfferSoftPaywall, state: next };
}

export async function markSoftPaywallPresented(): Promise<void> {
  const prev = await readState();
  await writeState({ ...prev, softPaywallPresented: true });
}

/** For tests / debug. */
export async function resetEngagementPaywallState(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
