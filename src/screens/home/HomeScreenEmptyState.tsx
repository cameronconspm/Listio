import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { EmptyState } from '../../components/ui/EmptyState';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { useTheme } from '../../design/ThemeContext';

type Props = {
  /** Same as Store / Recipes: `tabScrollPaddingTopBelowHeader(headerHeight)`. */
  scrollContentPaddingTop: number;
  onPressAdd: () => void;
};

/**
 * Matches Recipes empty branch: padded root (flex 1 + horizontal screen padding) + top inset;
 * EmptyState handles vertical centering via its own flex wrapper.
 */
export function HomeScreenEmptyState({ scrollContentPaddingTop, onPressAdd }: Props) {
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
        title="No items yet"
        message="Add groceries to your list and shop in section order to match your store."
        glass={false}
      >
        <PrimaryButton title="Add your first item" onPress={onPressAdd} />
      </EmptyState>
    </View>
  );
}
