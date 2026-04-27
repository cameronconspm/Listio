import React from 'react';
import { View, type ViewStyle, type StyleProp } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../design/ThemeContext';

type ScreenProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** If true, apply horizontal padding (`theme.spacing.lg`). Default true. */
  padded?: boolean;
  /** If true, use safe area insets for top/bottom. Default true. */
  safe?: boolean;
  /** If false, skip top safe area (use when screen has a stack header). Default true. */
  safeTop?: boolean;
  /** If false, skip bottom safe area (use when screen is in tab navigator – tab bar handles it). Default true. */
  safeBottom?: boolean;
};

/** Wraps screen content with background, optional safe area, and consistent padding. */
export function Screen({ children, style, padded = true, safe = true, safeTop = true, safeBottom = true }: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const wrapperStyle: ViewStyle = {
    flex: 1,
    backgroundColor: theme.background,
    ...(safe && safeTop && { paddingTop: insets.top }),
    ...(safe && safeBottom && { paddingBottom: insets.bottom }),
    ...(padded && {
      paddingHorizontal: theme.spacing.lg,
    }),
  };

  return <View style={[wrapperStyle, style]}>{children}</View>;
}
