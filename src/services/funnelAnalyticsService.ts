import AsyncStorage from '@react-native-async-storage/async-storage';
import { patchUserPreferencesIfSync, fetchUserPreferences } from './userPreferencesService';
import type { UserPreferencesPayload } from '../types/preferences';
import { captureException } from './sentryService';
import { isSyncEnabled } from './supabaseClient';

const LOCAL_QUEUE_KEY = '@listio/funnel_analytics_queue_v1';

export type FunnelEventName =
  | 'welcome_intro_complete'
  | 'auth_login_success'
  | 'auth_signup_complete'
  | 'onboarding_step'
  | 'onboarding_complete'
  | 'first_item_added'
  | 'first_shop_run_complete';

export type FunnelEvent = {
  name: FunnelEventName;
  at: string;
  props?: Record<string, string | number | boolean>;
};

type FunnelAnalyticsPayload = NonNullable<UserPreferencesPayload['funnelAnalytics']>;

function mergeEvent(
  prev: FunnelAnalyticsPayload | undefined,
  event: FunnelEvent
): FunnelAnalyticsPayload {
  const next: FunnelAnalyticsPayload = { ...(prev ?? {}), lastEventAt: event.at, lastEventName: event.name };
  const props = event.props ?? {};

  switch (event.name) {
    case 'welcome_intro_complete':
      next.welcomeIntroCompleteAt = event.at;
      break;
    case 'auth_login_success':
      next.lastLoginAt = event.at;
      break;
    case 'auth_signup_complete':
      next.signupCompleteAt = event.at;
      break;
    case 'onboarding_step':
      if (typeof props.step === 'number') {
        next.onboardingStepsReached = Math.max(next.onboardingStepsReached ?? 0, props.step);
      }
      break;
    case 'onboarding_complete':
      next.onboardingCompleteAt = event.at;
      break;
    case 'first_item_added':
      if (!next.firstItemAddedAt) next.firstItemAddedAt = event.at;
      break;
    case 'first_shop_run_complete':
      if (!next.firstShopRunCompleteAt) next.firstShopRunCompleteAt = event.at;
      break;
    default:
      break;
  }

  next.recentEvents = [...(next.recentEvents ?? []).slice(-19), event];
  return next;
}

async function readLocalQueue(): Promise<FunnelEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as FunnelEvent[]) : [];
  } catch {
    return [];
  }
}

async function writeLocalQueue(events: FunnelEvent[]): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCAL_QUEUE_KEY, JSON.stringify(events.slice(-40)));
  } catch {
    // Non-fatal
  }
}

/** Fire-and-forget funnel event — queues locally and syncs when authenticated. */
export function logFunnelEvent(
  name: FunnelEventName,
  props?: Record<string, string | number | boolean>
): void {
  void (async () => {
    const event: FunnelEvent = { name, at: new Date().toISOString(), props };
    try {
      const queue = await readLocalQueue();
      queue.push(event);
      await writeLocalQueue(queue);

      if (!isSyncEnabled()) return;

      const prev = await fetchUserPreferences();
      const merged = mergeEvent(prev.funnelAnalytics, event);
      await patchUserPreferencesIfSync({ funnelAnalytics: merged });
    } catch (e) {
      captureException(e, { funnelEvent: name });
    }
  })();
}

/** Merge queued pre-auth events after sign-in (best-effort). */
export async function flushFunnelAnalyticsQueue(): Promise<void> {
  const queue = await readLocalQueue();
  if (queue.length === 0) return;

  let merged: FunnelAnalyticsPayload | undefined;
  for (const event of queue) {
    merged = mergeEvent(merged, event);
  }

  try {
    await patchUserPreferencesIfSync({ funnelAnalytics: merged });
    await AsyncStorage.removeItem(LOCAL_QUEUE_KEY);
  } catch {
    // Keep queue for a later attempt
  }
}

/** Test-only reset */
export async function __resetFunnelAnalyticsForTests(): Promise<void> {
  await AsyncStorage.removeItem(LOCAL_QUEUE_KEY);
}
