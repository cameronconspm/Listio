import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { EmptyState } from '../../components/ui/EmptyState';
import { ListModeToggleBar } from '../../components/list/ListModeToggleBar';
import { useTheme } from '../../design/ThemeContext';

type Props = {
  scrollContentPaddingTop: number;
  scrollContentPaddingBottom: number;
  shoppingMode: 'plan' | 'shop';
  onShoppingModeChange: (mode: 'plan' | 'shop') => void;
  reorderMode?: boolean;
};

/** Empty list branch — Plan/Shop toggle scrolls with content like the populated list. */
export function HomeScreenEmptyState({
  scrollContentPaddingTop,
  scrollContentPaddingBottom,
  shoppingMode,
  onShoppingModeChange,
  reorderMode = false,
}: Props) {
  const theme = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        scroll: { flex: 1 },
        content: {
          flexGrow: 1,
          paddingHorizontal: theme.spacing.md,
        },
        modeToggleWrap: {
          marginBottom: theme.spacing.sm,
        },
        emptyWrap: {
          flex: 1,
          paddingHorizontal: theme.spacing.xs,
        },
      }),
    [theme],
  );

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { paddingTop: scrollContentPaddingTop, paddingBottom: scrollContentPaddingBottom },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.modeToggleWrap}>
        <ListModeToggleBar
          shoppingMode={shoppingMode}
          onShoppingModeChange={onShoppingModeChange}
          reorderMode={reorderMode}
        />
      </View>
      <View style={styles.emptyWrap}>
        <EmptyState
          icon="cart-outline"
          mascot="empty"
          title="Your list's empty for now"
          message="Add a few things and we'll line them up by aisle, so your next shop is one smooth loop."
          glass={false}
        />
      </View>
    </ScrollView>
  );
}
