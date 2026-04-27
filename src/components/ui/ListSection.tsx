import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../../design/ThemeContext';
import { GlassSurface } from './GlassSurface';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';

type ListSectionProps = {
  title?: string;
  /** Small caps / uppercase label when true; otherwise title2. */
  titleVariant?: 'small' | 'title2';
  /** Optional element to show on the right side of the title (e.g. Edit icon). */
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  /** When true, wrap in GlassSurface. Default true. */
  glass?: boolean;
  /** When true, use overflow visible (e.g. for swipe actions). Default false. */
  overflowVisible?: boolean;
  /** Tighter vertical padding and section theme.spacing. Default false. */
  dense?: boolean;
  style?: ViewStyle;
};

/** Grouped list section container with optional title. */
export function ListSection({
  title,
  titleVariant = 'small',
  headerRight,
  children,
  glass = true,
  overflowVisible = false,
  dense = false,
  style,
}: ListSectionProps) {
  const theme = useTheme();
  const content = (
    <View style={dense ? styles.contentDense : styles.content}>
      {title || headerRight ? (
        <View style={styles.headerRow}>
          {title ? (
            <Text
              style={[
                titleVariant === 'small' ? theme.typography.caption1 : theme.typography.title2,
                {
                  color: theme.textSecondary,
                  textTransform: titleVariant === 'small' ? ('uppercase' as const) : undefined,
                },
              ]}
            >
              {title}
            </Text>
          ) : null}
          {headerRight ?? null}
        </View>
      ) : null}
      {children}
    </View>
  );

  const wrapperStyle = [
    styles.wrapper,
    dense && styles.wrapperDense,
    overflowVisible && styles.overflowVisible,
    style,
  ];

  if (glass) {
    return (
      <GlassSurface style={wrapperStyle} borderRadius={theme.radius.glass}>
        {content}
      </GlassSurface>
    );
  }

  return (
    <View style={[wrapperStyle, { backgroundColor: theme.surface, borderRadius: theme.radius.card, ...theme.shadows.card }]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  wrapperDense: {
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  overflowVisible: {
    overflow: 'visible',
  },
  content: {
    flex: 1,
  },
  /** No flex — avoids stretched gaps between stacked sections in ScrollViews / form sheets. */
  contentDense: {
    alignSelf: 'stretch',
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
});
