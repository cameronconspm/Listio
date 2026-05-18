import React from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../design/ThemeContext';
import { GlassView } from './GlassView';

type GlassPrimitiveProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
};

type GlassControlProps = GlassPrimitiveProps & {
  shape?: 'circle' | 'pill';
  size?: number;
};

export function GlassControl({
  children,
  style,
  intensity = 34,
  shape = 'pill',
  size = 44,
}: GlassControlProps) {
  const theme = useTheme();
  return (
    <GlassView
      intensity={intensity}
      borderRadius={shape === 'circle' ? size / 2 : theme.radius.full}
      style={style}
    >
      {children}
    </GlassView>
  );
}

export function GlassInputBar({ children, style, intensity = 38 }: GlassPrimitiveProps) {
  const theme = useTheme();
  return (
    <GlassView intensity={intensity} borderRadius={theme.radius.full} style={style}>
      {children}
    </GlassView>
  );
}

export function GlassMenu({ children, style, intensity = 38 }: GlassPrimitiveProps) {
  const theme = useTheme();
  return (
    <GlassView intensity={intensity} borderRadius={theme.radius.xl} style={style}>
      {children}
    </GlassView>
  );
}
