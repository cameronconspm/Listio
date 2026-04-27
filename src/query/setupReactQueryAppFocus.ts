import { AppState, type AppStateStatus, Platform } from 'react-native';
import { focusManager } from '@tanstack/react-query';

/**
 * When the app returns to foreground, stale queries can refetch (`refetchOnWindowFocus`).
 */
export function subscribeReactQueryAppFocus(): () => void {
  if (Platform.OS === 'web') {
    return () => {};
  }

  const onChange = (status: AppStateStatus) => {
    focusManager.setFocused(status === 'active');
  };

  const sub = AppState.addEventListener('change', onChange);
  onChange(AppState.currentState);

  return () => sub.remove();
}
