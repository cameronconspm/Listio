import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { useTheme } from '../../design/ThemeContext';
import { useChromeFrostedForSettings } from '../../navigation/NavigationChromeScrollContext';
import { ChromeBlurLayers } from './ChromeBlurLayers';

/**
 * Native stack `headerBackground` for Settings — matches tab header material (blur + solid at rest).
 */
export function SettingsStackHeaderChrome() {
  const theme = useTheme();
  const frosted = useChromeFrostedForSettings();
  const solidStyle = useAnimatedStyle(() => ({
    opacity: interpolate(frosted.value, [0, 1], [1, 0]),
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <ChromeBlurLayers />
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.background }, solidStyle]}
        pointerEvents="none"
      />
    </View>
  );
}
