import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { useTheme } from '../../design/ThemeContext';
import { useChromeFrostedForTab } from '../../navigation/NavigationChromeScrollContext';
import type { TabChromeRootKey } from '../../navigation/navigationChromeScroll';
import { ChromeBlurLayers } from './ChromeBlurLayers';

type NavigationChromeSurfaceProps = {
  children: React.ReactNode;
  /** Tab route name — drives solid-at-rest vs frosted when scrolled */
  tabKey: TabChromeRootKey;
};

/**
 * Navigation chrome: blur + optional solid overlay matching page background at scroll rest.
 */
export function NavigationChromeSurface({ children, tabKey }: NavigationChromeSurfaceProps) {
  const theme = useTheme();
  const frosted = useChromeFrostedForTab(tabKey);
  const solidStyle = useAnimatedStyle(() => ({
    opacity: interpolate(frosted.value, [0, 1], [1, 0]),
  }));

  return (
    <View style={styles.root}>
      <ChromeBlurLayers />
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.background }, solidStyle]}
        pointerEvents="none"
      />
      <View style={styles.foreground} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  foreground: {
    position: 'relative',
    zIndex: 1,
  },
});
