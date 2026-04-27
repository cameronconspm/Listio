import { CommonActions } from '@react-navigation/native';
import { navigationRef } from '../navigation/navigationRef';
import { logNotificationMetric } from './notificationAnalyticsService';
import { logger } from '../utils/logger';

export function navigateFromPayload(data: Record<string, unknown> | undefined): void {
  const nav = data?.navigateTo;
  if (nav !== 'meals' && nav !== 'list' && nav !== 'recipes' && nav !== 'store') return;
  if (!navigationRef.isReady()) return;

  if (nav === 'list') {
    navigationRef.dispatch(
      CommonActions.navigate({
        name: 'AppTabs',
        params: {
          screen: 'ListTab',
          params: { screen: 'List' },
        },
      })
    );
    return;
  }
  if (nav === 'meals') {
    navigationRef.dispatch(
      CommonActions.navigate({
        name: 'AppTabs',
        params: {
          screen: 'MealsStack',
          params: { screen: 'MealsList' },
        },
      })
    );
    return;
  }
  if (nav === 'recipes') {
    navigationRef.dispatch(
      CommonActions.navigate({
        name: 'AppTabs',
        params: {
          screen: 'RecipesStack',
          params: { screen: 'RecipesList' },
        },
      })
    );
    return;
  }
  /* `store` and any other legacy tab id: open List (store UI removed). */
  navigationRef.dispatch(
    CommonActions.navigate({
      name: 'AppTabs',
      params: {
        screen: 'ListTab',
        params: { screen: 'List' },
      },
    })
  );
}

/** Cold start: user opened app by tapping a notification. */
export function handleColdStartNotificationIfAny(): void {
  void import('expo-notifications')
    .then((Notifications) =>
      Notifications.getLastNotificationResponseAsync().then((response) => {
        if (!response?.notification) return;
        const data = response.notification.request.content.data as Record<string, unknown> | undefined;
        void logNotificationMetric('open_from_notification');
        navigateFromPayload(data);
      })
    )
    .catch((e) => {
      logger.warnRelease('notificationNavigationService: cold start', e);
    });
}

/** Foreground / background → tap. Returns cleanup. */
export function subscribeNotificationOpenHandlers(): () => void {
  let remove: (() => void) | undefined;
  let cancelled = false;
  void import('expo-notifications')
    .then((Notifications) => {
      if (cancelled) return;
      const sub = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as Record<string, unknown> | undefined;
        void logNotificationMetric('open_from_notification');
        navigateFromPayload(data);
      });
      remove = () => sub.remove();
    })
    .catch((e) => {
      logger.warnRelease('notificationNavigationService: subscribe', e);
    });
  return () => {
    cancelled = true;
    remove?.();
  };
}
