import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { useTheme } from '../../design/ThemeContext';
import { useChromeFrostedForActiveTab } from '../../navigation/NavigationChromeScrollContext';
import { ChromeBlurLayers } from './ChromeBlurLayers';

/**
 * Bottom tab bar: same blur + solid-at-rest treatment as tab headers.
 */
export function TabBarChromeBackground() {
  const theme = useTheme();
  const frosted = useChromeFrostedForActiveTab();
  const solidStyle = useAnimatedStyle(() => ({
    opacity: interpolate(frosted.value, [0, 1], [1, 0]),
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <ChromeBlurLayers />
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.background }, solidStyle]}
        pointerEvents="none"
      />
    </View>
  );
}
