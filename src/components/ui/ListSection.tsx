import React, { useMemo } from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../../design/ThemeContext';
import { GlassSurface } from './GlassSurface';
import { cardShellStyle, type CardSurface, type CardTone } from './Card';
import { RECIPE_CARD_GAP } from '../../design/recipeLayout';

type ListSectionProps = {
  title?: string;
  /** Small caps / uppercase label when true; otherwise title2. */
  titleVariant?: 'small' | 'title2';
  /** Optional element to show on the right side of the title (e.g. Edit icon). */
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  /** When true, wrap in GlassSurface. Default true. */
  glass?: boolean;
  /** Surface treatment — overrides `glass` when set. */
  surface?: CardSurface;
  tone?: CardTone;
  /** When true, use overflow visible (e.g. for swipe actions). Default false. */
  overflowVisible?: boolean;
  /** Tighter vertical padding and section theme.spacing. Default false. */
  dense?: boolean;
  /**
   * Row-only sections: zero horizontal shell padding so dividers span the card,
   * while the section title keeps the same inset as `ListRow` text.
   */
  contentFlush?: boolean;
  style?: ViewStyle;
};

/** Grouped list section container with optional title. */
export function ListSection({
  title,
  titleVariant = 'small',
  headerRight,
  children,
  glass = true,
  surface,
  tone = 'default',
  overflowVisible = false,
  dense = false,
  contentFlush = false,
  style,
}: ListSectionProps) {
  const theme = useTheme();
  const resolvedSurface = surface ?? (glass ? 'glass' : 'raised');

  const spacingStyles = useMemo(
    () => ({
      wrapper: {
        paddingHorizontal: contentFlush ? 0 : theme.spacing.md,
        paddingVertical: theme.spacing.md,
        marginBottom: theme.spacing.lg,
        borderRadius: theme.radius.card,
      } as ViewStyle,
      wrapperDense: {
        paddingVertical: theme.spacing.sm,
        marginBottom: RECIPE_CARD_GAP,
      } as ViewStyle,
      headerRow: {
        marginBottom: dense ? theme.spacing.xs : theme.spacing.base,
        ...(contentFlush ? { paddingHorizontal: theme.spacing.md } : null),
      } as ViewStyle,
    }),
    [theme.spacing, theme.radius.card, dense, contentFlush],
  );
  const content = (
    <View style={dense ? styles.contentDense : styles.content}>
      {title || headerRight ? (
        <View style={[styles.headerRow, spacingStyles.headerRow]}>
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
    spacingStyles.wrapper,
    dense && styles.wrapperDense,
    dense && spacingStyles.wrapperDense,
    overflowVisible && styles.overflowVisible,
    style,
  ];

  if (resolvedSurface === 'glass') {
    return (
      <GlassSurface style={wrapperStyle} borderRadius={theme.radius.glass}>
        {content}
      </GlassSurface>
    );
  }

  return (
    <View
      style={[
        wrapperStyle,
        cardShellStyle(theme, resolvedSurface, tone),
        { borderRadius: theme.radius.card },
      ]}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
  },
  wrapperDense: {},
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
  },
});
