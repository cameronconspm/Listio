import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { SegmentedControl } from '../ui/SegmentedControl';
import { useReduceMotion } from '../../ui/motion/useReduceMotion';
import { listModeSwapTiming } from '../../ui/motion/controls';

type ListModeToggleBarProps = {
  shoppingMode: 'plan' | 'shop';
  onShoppingModeChange: (mode: 'plan' | 'shop') => void;
};

/** Plan / Shop segmented control for the list tab scroll content. */
export const ListModeToggleBar = React.memo(function ListModeToggleBar({
  shoppingMode,
  onShoppingModeChange,
}: ListModeToggleBarProps) {
  const reduceMotion = useReduceMotion();
  const pillTiming = useMemo(() => listModeSwapTiming(reduceMotion), [reduceMotion]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          height: 44,
          justifyContent: 'center',
          alignItems: 'stretch',
          width: '100%',
        },
      }),
    []
  );

  return (
    <View style={styles.row}>
      <SegmentedControl<'plan' | 'shop'>
        variant="solid"
        pillTiming={pillTiming}
        segments={[
          { key: 'plan', label: 'Plan' },
          { key: 'shop', label: 'Shop' },
        ]}
        value={shoppingMode}
        onChange={onShoppingModeChange}
      />
    </View>
  );
});
