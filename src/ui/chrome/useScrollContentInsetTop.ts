import { useHeaderHeight } from '@react-navigation/elements';
import { useTheme } from '../../design/ThemeContext';

/**
 * Padding above scroll content when using translucent headers (headerTransparent).
 * Header height + small gap below chrome (no duplicate safe-area — handled by chrome).
 */
export function useScrollContentInsetTop(): number {
  const headerHeight = useHeaderHeight();
  const theme = useTheme();
  return headerHeight + theme.spacing.sm;
}
