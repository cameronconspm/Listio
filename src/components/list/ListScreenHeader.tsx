import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../design/ThemeContext';
import { tabRootHeaderHeight } from '../../design/layout';
import { NavigationChromeSurface } from '../../ui/chrome/NavigationChromeSurface';
import { SegmentedControl } from '../ui/SegmentedControl';

type ListScreenHeaderProps = {
  shoppingMode: 'plan' | 'shop';
  onShoppingModeChange: (mode: 'plan' | 'shop') => void;
  /** While reordering sections, header toggle is non-interactive. */
  reorderMode?: boolean;
};

/** Custom list header: Plan / Shop mode (store selector and settings moved to Profile tab). */
export function ListScreenHeader({
  shoppingMode,
  onShoppingModeChange,
  reorderMode = false,
}: ListScreenHeaderProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: {
          backgroundColor: 'transparent',
          height: tabRootHeaderHeight(insets.top, theme.spacing),
          paddingHorizontal: theme.spacing.md,
          paddingTop: insets.top + theme.spacing.sm,
          paddingBottom: theme.spacing.xs,
        },
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
    [insets.top, theme],
  );

  return (
    <NavigationChromeSurface tabKey="ListTab">
      <View style={styles.safe}>
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
      </View>
    </NavigationChromeSurface>
  );
}
