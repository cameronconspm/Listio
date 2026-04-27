import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../design/ThemeContext';
import { navigationChromeBlur, navigationChromeTintOverlay } from './navigationChrome';

/**
 * Shared blur + neutral tint stack for all navigation chrome.
 * No hairlines — separation comes from material only.
 */
export function ChromeBlurLayers() {
  const theme = useTheme();
  const scheme = theme.colorScheme;
  const blurTint = scheme === 'dark' ? 'dark' : 'light';
  const intensity =
    Platform.OS === 'ios' ? navigationChromeBlur.chrome : navigationChromeBlur.chromeAndroid;
  const overlay = navigationChromeTintOverlay(scheme);

  return (
    <>
      <BlurView tint={blurTint} intensity={intensity} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: overlay }]} pointerEvents="none" />
    </>
  );
}
