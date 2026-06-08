import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSyncEnabled } from './supabaseClient';
import { requestNotificationPermissionsPrompting } from './notificationSchedulingService';
import { patchUserPreferences } from './userPreferencesService';
import { refreshDynamicNotifications } from './notificationRefreshService';
import { registerAndSyncPushToken } from './pushTokenService';
import { logger } from '../utils/logger';

const STORAGE_KEY = '@listio/notif_first_win_prompt_v1';

async function wasPrompted(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEY)) === 'true';
  } catch {
    return false;
  }
}

async function markPrompted(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    /* best-effort */
  }
}

/** Turn on sensible default reminders after the user opts in; they refine in Settings. */
async function enableDefaultReminders(): Promise<void> {
  const granted = await requestNotificationPermissionsPrompting();
  if (!granted || !isSyncEnabled()) return;
  try {
    await patchUserPreferences({
      notifications: {
        shoppingReminders: true,
        usePersonalizedShoppingReminders: false,
        mealReminders: true,
        mealReminderMode: 'planned_only',
      },
    });
    await refreshDynamicNotifications();
    await registerAndSyncPushToken();
  } catch (e) {
    logger.warn('notif-first-win: failed to enable default reminders', {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

/**
 * Prompt for notifications once, after the user's first real win (their first
 * completed shop run) — never during onboarding. Uses a soft priming alert so
 * the one-shot OS permission dialog is only spent on users who opt in.
 *
 * @returns true if the priming alert was shown this call (so callers can avoid
 *          stacking another prompt, e.g. the App Store review request).
 */
export async function maybePromptNotificationsAfterFirstWin(): Promise<boolean> {
  if (await wasPrompted()) return false;
  await markPrompted();
  Alert.alert(
    'Want a heads-up before your next shop?',
    "We can remind you before your usual shopping day so your list's ready. Change the timing anytime in Settings.",
    [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Turn on',
        onPress: () => {
          void enableDefaultReminders();
        },
      },
    ]
  );
  return true;
}

/** For tests / debug. */
export async function resetFirstWinNotifPromptForTests(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
