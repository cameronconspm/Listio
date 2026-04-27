import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../design/ThemeContext';
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
  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: {
          backgroundColor: 'transparent',
          paddingHorizontal: theme.spacing.md,
          paddingTop: theme.spacing.sm,
          paddingBottom: theme.spacing.xs,
        },
        row: {
          minHeight: 44,
          justifyContent: 'center',
          alignItems: 'stretch',
          width: '100%',
        },
        rowDimmed: {
          opacity: 0.48,
        },
      }),
    [theme],
  );

  return (
    <NavigationChromeSurface tabKey="ListTab">
      <SafeAreaView edges={['top']} style={styles.safe}>
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
      </SafeAreaView>
    </NavigationChromeSurface>
  );
}
