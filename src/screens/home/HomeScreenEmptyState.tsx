import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { EmptyState } from '../../components/ui/EmptyState';
import { useTheme } from '../../design/ThemeContext';

type Props = {
  /** Top inset when banner is not above this block (0 when usage banner handles header offset). */
  scrollContentPaddingTop: number;
};

/**
 * Matches Recipes empty branch: padded root (flex 1 + horizontal screen padding) + top inset;
 * EmptyState handles vertical centering via its own flex wrapper.
 */
export function HomeScreenEmptyState({ scrollContentPaddingTop }: Props) {
  const theme = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        paddedBody: {
          flex: 1,
          paddingHorizontal: theme.spacing.lg,
        },
      }),
    [theme],
  );

  return (
    <View style={[styles.paddedBody, { paddingTop: scrollContentPaddingTop }]}>
      <EmptyState
        icon="cart-outline"
        mascot="empty"
        title="Your list's empty — for now"
        message="Add a few things and we'll line them up by aisle, so your next shop is one smooth loop."
        glass={false}
      />
    </View>
  );
}
