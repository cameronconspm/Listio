import { useMemo } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useScrollContentInsetTop } from '../../ui/chrome/useScrollContentInsetTop';
import { useTheme } from '../../design/ThemeContext';

/**
 * Translucent header + scroll under home indicator: content padding for Settings screens.
 */
export function useSettingsScrollInsets() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const paddingTop = useScrollContentInsetTop();
  const paddingBottom = insets.bottom + theme.spacing.xxl;
  return useMemo(
    () => ({
      paddingTop,
      paddingBottom,
      contentInsetBehavior: Platform.OS === 'ios' ? ('never' as const) : undefined,
      scrollEventThrottle: 16 as const,
    }),
    [paddingTop, paddingBottom],
  );
}
