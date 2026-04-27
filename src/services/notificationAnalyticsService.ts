import type { UserPreferencesPayload } from '../types/preferences';
import { patchUserPreferencesIfSync } from './userPreferencesService';

export type NotificationMetricEvent =
  | 'permission_prompt'
  | 'open_from_notification'
  | 'disabled_system_notifications';

export async function logNotificationMetric(
  event: NotificationMetricEvent,
  extra?: Partial<NonNullable<UserPreferencesPayload['notifications']>['notificationAnalytics']>
): Promise<void> {
  const now = new Date().toISOString();
  const base = extra ?? {};
  const analytics =
    event === 'permission_prompt'
      ? { ...base, lastPermissionPromptAt: now }
      : event === 'open_from_notification'
        ? { ...base, lastOpenedFromNotificationAt: now }
        : { ...base, disabledSystemNotificationsAt: now };
  await patchUserPreferencesIfSync({
    notifications: { notificationAnalytics: analytics },
  });
}
