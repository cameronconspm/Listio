import type { ViewStyle } from 'react-native';

/** Apple HIG: tab bar content height 49pt + safe area */
export const TAB_BAR_CONTENT_HEIGHT = 49;

/** Bottom tab bar overlays the scene; height includes home indicator inset. */
export function createTabBarStyleVisible(safeAreaBottom: number): ViewStyle {
  return {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 0,
    paddingTop: 0,
    backgroundColor: 'transparent',
    elevation: 0,
    shadowOpacity: 0,
    height: TAB_BAR_CONTENT_HEIGHT + safeAreaBottom,
  };
}

/**
 * Hide the tab bar without `display: 'none'`, which can fail to restore after
 * native-stack interactive pop gestures on iOS.
 */
export function createTabBarStyleHidden(): ViewStyle {
  return {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 0,
    minHeight: 0,
    opacity: 0,
    overflow: 'hidden',
    borderTopWidth: 0,
    paddingTop: 0,
    paddingBottom: 0,
    backgroundColor: 'transparent',
    elevation: 0,
    shadowOpacity: 0,
    pointerEvents: 'none',
  };
}
