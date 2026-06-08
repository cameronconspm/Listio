import React, { useMemo } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { GlassView } from './GlassView';
import { useTheme } from '../../design/ThemeContext';

/** Surface depth — maps to the shared elevation scale in shadows.ts. */
export type CardSurface = 'glass' | 'raised' | 'flat' | 'nested';

/** Semantic card roles for consistent tone across screens. */
export type CardTone = 'default' | 'interactive' | 'informational' | 'status';

type CardProps = {
  children: React.ReactNode;
  /** Legacy toggle; prefer `surface`. Default true. */
  glass?: boolean;
  surface?: CardSurface;
  tone?: CardTone;
  style?: StyleProp<ViewStyle>;
};

function resolveSurface(glass: boolean, surface?: CardSurface): CardSurface {
  if (surface) return surface;
  return glass ? 'glass' : 'raised';
}

/** Shared shell styles for raised / nested tiles (list sections, meal slots, recipes). */
export function cardShellStyle(
  theme: ReturnType<typeof useTheme>,
  surface: Exclude<CardSurface, 'glass'>,
  tone: CardTone = 'default'
): ViewStyle {
  switch (surface) {
    case 'flat':
      return {
        backgroundColor: theme.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.divider,
      };
    case 'nested':
      return {
        backgroundColor: theme.background,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.divider,
        ...theme.shadows.elevated,
      };
    case 'raised':
    default:
      break;
  }

  const raised: ViewStyle = {
    backgroundColor: theme.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.surfaceBorder,
    ...theme.shadows.card,
  };

  if (tone === 'informational') {
    return {
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.divider,
    };
  }

  if (tone === 'status') {
    return {
      ...raised,
      borderColor: theme.accent + '44',
      backgroundColor: theme.accent + '0c',
    };
  }

  if (tone === 'interactive') {
    return {
      ...raised,
      ...theme.shadows.elevated,
    };
  }

  return raised;
}

export function Card({
  children,
  glass = true,
  surface,
  tone = 'default',
  style,
}: CardProps) {
  const theme = useTheme();
  const resolvedSurface = resolveSurface(glass, surface);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          padding: theme.spacing.md,
          borderRadius: theme.radius.card,
          overflow: 'hidden',
        },
      }),
    [theme]
  );

  if (resolvedSurface === 'glass') {
    return (
      <GlassView style={[styles.card, style]} borderRadius={theme.radius.card}>
        {children}
      </GlassView>
    );
  }

  return (
    <View
      style={[
        styles.card,
        cardShellStyle(theme, resolvedSurface, tone),
        style,
      ]}
    >
      {children}
    </View>
  );
}
