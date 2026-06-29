import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { SegmentedControl } from '../ui/SegmentedControl';

type ListModeToggleBarProps = {
  shoppingMode: 'plan' | 'shop';
  onShoppingModeChange: (mode: 'plan' | 'shop') => void;
  /** While reordering sections, toggle is non-interactive. */
  reorderMode?: boolean;
};

/** Plan / Shop segmented control — sits below the list switcher header chrome. */
export function ListModeToggleBar({
  shoppingMode,
  onShoppingModeChange,
  reorderMode = false,
}: ListModeToggleBarProps) {
  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          height: 44,
          justifyContent: 'center',
          alignItems: 'stretch',
          width: '100%',
        },
        rowDimmed: {
          opacity: 0.48,
        },
      }),
    []
  );

  return (
    <View
      style={[styles.row, reorderMode && styles.rowDimmed]}
      pointerEvents={reorderMode ? 'none' : 'auto'}
    >
      <SegmentedControl<'plan' | 'shop'>
        segments={[
          { key: 'plan', label: 'Plan' },
          { key: 'shop', label: 'Shop' },
        ]}
        value={shoppingMode}
        onChange={onShoppingModeChange}
      />
    </View>
  );
}
