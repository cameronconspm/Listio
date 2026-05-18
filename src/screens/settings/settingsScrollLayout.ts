import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../design/ThemeContext';

/**
 * Native stack header + scroll under home indicator: content padding for Settings screens.
 */
export function useSettingsScrollInsets() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const paddingBottom = insets.bottom + theme.spacing.xxl;
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
