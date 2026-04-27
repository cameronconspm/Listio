import React from 'react';
import { View, StyleSheet, Platform, type ViewStyle, type StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../design/ThemeContext';

type GlassViewProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  borderRadius?: number;
};

export function GlassView({ children, style, intensity = 30, borderRadius: borderRadiusProp }: GlassViewProps) {
  const theme = useTheme();
  const borderRadius = borderRadiusProp ?? theme.radius.lg;
  const tint = theme.colorScheme === 'dark' ? 'dark' : 'light';
  const isGlass = Platform.OS === 'ios';

  const containerStyle: ViewStyle = {
    borderRadius,
    overflow: 'hidden',
    backgroundColor: theme.surfaceGlass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.divider,
    ...theme.shadows.sm,
  };

  if (isGlass) {
    return (
      <View style={[containerStyle, style]}>
        <BlurView
          tint={tint}
          intensity={intensity}
          style={[StyleSheet.absoluteFill, { borderRadius }]}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: theme.surfaceGlass, borderRadius },
          ]}
          pointerEvents="none"
        />
        <View style={styles.content}>{children}</View>
      </View>
    );
  }

  return <View style={[containerStyle, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  /** No flex:1 — inside ScrollView an unbounded parent + flex child often collapses to height 0. */
  content: {
    zIndex: 1,
  },
});
