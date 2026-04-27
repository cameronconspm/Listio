import { Platform } from 'react-native';
import { supabase, getUserId, isSyncEnabled } from './supabaseClient';
import { logger } from '../utils/logger';

function getExpoProjectId(): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Constants = require('expo-constants') as typeof import('expo-constants');
    const mod = Constants.default ?? Constants;
    const extra = mod.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
    return (
      extra?.eas?.projectId ??
      (mod as { easConfig?: { projectId?: string } }).easConfig?.projectId
    );
  } catch {
    return undefined;
  }
}

function loadNotifications(): typeof import('expo-notifications') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-notifications') as typeof import('expo-notifications');
}

/** Avoid top-level `expo-device` import — same eager chain as expo-notifications (App → RootNavigator → … → pushTokenService). */
function isPhysicalDevice(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Device = require('expo-device') as typeof import('expo-device');
    return Device.isDevice === true;
  } catch {
    return false;
  }
}

type RegisterPushTokenOptions = {
  /**
   * When false, never show the OS permission prompt. This keeps app startup
   * from surprising users; explicit onboarding/settings actions should request
   * permission before calling this helper.
   */
  promptForPermission?: boolean;
};

/** Registers for Expo push and upserts token for remote notifications (household, etc.). */
export async function registerAndSyncPushToken(
  options: RegisterPushTokenOptions = {}
): Promise<string | null> {
  try {
    if (!isSyncEnabled()) return null;
    if (!isPhysicalDevice()) return null;

    const Notifications = loadNotifications();
    const { status: existing } = await Notifications.getPermissionsAsync();
    let final = existing;
    if (existing !== 'granted' && options.promptForPermission === true) {
      const { status } = await Notifications.requestPermissionsAsync();
      final = status;
    }
    if (final !== 'granted') return null;

    const projectId = getExpoProjectId();
    const tokenRes = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenRes.data;
    const uid = await getUserId();
    if (!uid) return null;

    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    const { error } = await supabase.from('user_push_tokens').upsert(
      { user_id: uid, expo_push_token: token, platform, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
    if (error) {
      logger.warn('pushTokenService: upsert failed', error.message);
      return null;
    }
    return token;
  } catch (e) {
    logger.warn('pushTokenService: register failed', e);
    return null;
  }
}

export async function removePushTokenRow(): Promise<void> {
  if (!isSyncEnabled()) return;
  const uid = await getUserId();
  if (!uid) return;
  await supabase.from('user_push_tokens').delete().eq('user_id', uid);
}
