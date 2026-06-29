import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import {
  createTabBarStyleHidden,
  createTabBarStyleVisible,
} from './tabBarLayout';

/** Sync bottom-tab bar visibility with nested stack depth (root = show, pushed = hide). */
export function syncTabBarWithStackDepth(
  navigation: NavigationProp<ParamListBase>,
  safeAreaBottom: number,
): void {
  const parent = navigation.getParent();
  if (!parent || parent.getState()?.type !== 'tab') return;

  const index = navigation.getState()?.index ?? 0;
  parent.setOptions({
    tabBarStyle:
      index > 0 ? createTabBarStyleHidden() : createTabBarStyleVisible(safeAreaBottom),
  });
}

/** Listeners for native stacks nested inside bottom tabs. */
export function createTabBarStackSyncListeners(
  sync: () => void,
): {
  state: () => void;
  focus: () => void;
  transitionEnd: () => void;
} {
  return {
    state: sync,
    focus: sync,
    transitionEnd: sync,
  };
}
