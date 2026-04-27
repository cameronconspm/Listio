import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ChromeBlurLayers } from './ChromeBlurLayers';

/**
 * Native stack `headerBackground`: matches tab-root chrome (`ChromeBlurLayers`) so pushed
 * screens (e.g. Add meal) look like List / Meals / Recipes headers instead of solid UIKit bar.
 */
export function ChromeStackHeaderBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <ChromeBlurLayers />
    </View>
  );
}
