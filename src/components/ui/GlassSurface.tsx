import React from 'react';
import { View, StyleSheet, Platform, type ViewStyle, type StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../design/ThemeContext';

type GlassSurfaceProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  borderRadius?: number;
  /** Lighter fill over BlurView for bottom sheets so content behind stays visible while blurred. */
  fillVariant?: 'default' | 'sheet';
};

/** Liquid Glass surface: BlurView + translucent fill + 1px highlight border + soft shadow. */
export function GlassSurface({
  children,
  style,
  intensity = 32,
  borderRadius: borderRadiusProp,
  fillVariant = 'default',
}: GlassSurfaceProps) {
  const theme = useTheme();
  const borderRadius = borderRadiusProp ?? theme.radius.glass;
  const tint = theme.colorScheme === 'dark' ? 'dark' : 'light';
  const fillColor = fillVariant === 'sheet' ? theme.surfaceGlassSheet : theme.surfaceGlass;
  const blurIntensity = fillVariant === 'sheet' ? Math.max(intensity, 55) : intensity;
  const borderHighlight =
    theme.colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.4)';
  const isGlass = Platform.OS === 'ios';

  const containerStyle: ViewStyle = {
    borderRadius,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: borderHighlight,
    ...theme.shadows.card,
  };

  if (isGlass) {
    return (
      <View style={[containerStyle, style]}>
        <BlurView
          tint={tint}
          intensity={blurIntensity}
          style={[StyleSheet.absoluteFill, { borderRadius }]}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: fillColor, borderRadius },
          ]}
          pointerEvents="none"
        />
        <View style={styles.content}>{children}</View>
      </View>
    );
  }

  return (
    <View style={[{ backgroundColor: fillColor }, containerStyle, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    zIndex: 1,
  },
});
