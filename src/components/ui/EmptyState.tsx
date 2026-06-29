import React, { useMemo } from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/ThemeContext';
import { GlassSurface } from './GlassSurface';
import { Mascot, type MascotMood } from '../brand/Mascot';
type EmptyStateProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  /** When set, show the Listio mascot instead of the generic icon circle. */
  mascot?: MascotMood;
  /** When true, wrap in GlassSurface. Default true. */
  glass?: boolean;
  style?: ViewStyle;
  /** Optional action (e.g. button) below the message */
  children?: React.ReactNode;
};

/** Centered empty state: icon (or mascot) + title + message. Optional glass card wrapper. */
export function EmptyState({
  icon,
  title,
  message,
  mascot,
  glass = true,
  style,
  children,
}: EmptyStateProps) {
  const theme = useTheme();
  const iconSize = 56;

  const spacingStyles = useMemo(
    () => ({
      wrapper: {
        paddingHorizontal: theme.spacing.xl,
        paddingVertical: theme.spacing.lg,
      } as ViewStyle,
      glass: {
        padding: theme.spacing.xxl,
      } as ViewStyle,
      iconWrap: {
        marginBottom: theme.spacing.lg,
      } as ViewStyle,
      mascot: {
        marginBottom: theme.spacing.md,
      } as ViewStyle,
      title: {
        marginBottom: theme.spacing.sm,
      } as ViewStyle,
      children: {
        marginTop: theme.spacing.lg,
      } as ViewStyle,
    }),
    [theme.spacing],
  );
  const content = (
    <View style={styles.content}>
      {mascot ? (
        <Mascot mood={mascot} size={132} style={spacingStyles.mascot} />
      ) : (
        <View style={[styles.iconWrap, spacingStyles.iconWrap, { backgroundColor: theme.surface }]}>
          <Ionicons name={icon} size={iconSize * 0.6} color={theme.textSecondary} />
        </View>
      )}
      <Text
        style={[
          theme.typography.title2,
          { color: theme.textPrimary, marginBottom: theme.spacing.sm, textAlign: 'center' },
        ]}
      >
        {title}
      </Text>
      <Text
        style={[
          theme.typography.subhead,
          { color: theme.textSecondary, textAlign: 'center', lineHeight: 22 },
        ]}
      >
        {message}
      </Text>
      {children ? <View style={[styles.children, spacingStyles.children]}>{children}</View> : null}
    </View>
  );

  if (glass) {
    return (
      <View style={[styles.wrapper, spacingStyles.wrapper, style]}>
        <GlassSurface style={[styles.glass, spacingStyles.glass]} borderRadius={theme.radius.glass}>
          {content}
        </GlassSurface>
      </View>
    );
  }

  return <View style={[styles.wrapper, spacingStyles.wrapper, style]}>{content}</View>;
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glass: {
    minWidth: 280,
  },
  content: {
    width: '100%',
    alignItems: 'center',
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  children: {
    alignSelf: 'stretch',
    width: '100%',
  },
});
