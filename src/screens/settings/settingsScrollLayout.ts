import { useMemo } from 'react';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../design/ThemeContext';
import {
  scrollPaddingBottomWithoutTabBar,
  tabRootScrollPaddingBottom,
} from '../../design/layout';

/**
 * Tab-root Profile hub: scroll clears the overlaid tab bar.
 */
export function useTabRootScrollInsets() {
  const theme = useTheme();
  const tabBarHeight = useBottomTabBarHeight();
  const paddingBottom = tabRootScrollPaddingBottom(tabBarHeight, theme.spacing);
  return useMemo(
    () => ({
      paddingTop: 0,
      paddingBottom,
      contentInsetBehavior: undefined,
      scrollEventThrottle: 16 as const,
    }),
    [paddingBottom],
  );
}

/**
 * Pushed settings screens (tab bar hidden): safe area + breathing room only.
 */
export function useSettingsScrollInsets() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const paddingBottom = scrollPaddingBottomWithoutTabBar(insets.bottom, theme.spacing);
  return useMemo(
    () => ({
      paddingTop: 0,
      paddingBottom,
      contentInsetBehavior: undefined,
      scrollEventThrottle: 16 as const,
    }),
    [paddingBottom],
  );
}
