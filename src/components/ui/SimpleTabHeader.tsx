import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../design/ThemeContext';
import { NavigationChromeSurface } from '../../ui/chrome/NavigationChromeSurface';
import type { TabChromeRootKey } from '../../navigation/navigationChromeScroll';

type SimpleTabHeaderProps = {
  rightContent?: React.ReactNode;
  /** Which tab’s scroll chrome to follow (blur vs solid). Default Store. */
  tabKey?: TabChromeRootKey;
};

/**
 * Empty tab chrome row (blur + safe area): same horizontal inset as List/Recipes headers, no title bar.
 * Use when the tab has no search/schedule — keeps stack header height aligned with other tabs.
 */
export function SimpleTabHeader({ rightContent, tabKey = 'ProfileStack' }: SimpleTabHeaderProps) {
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
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          /** Match header row minHeight with List `ListScreenHeader` / Recipes `RecipesHeader`. */
          minHeight: 44,
        },
        section: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          minWidth: 0,
        },
        leftSection: {
          justifyContent: 'flex-start',
        },
        rightSection: {
          justifyContent: 'flex-end',
        },
      }),
    [theme],
  );

  return (
    <NavigationChromeSurface tabKey={tabKey}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.row}>
          <View style={[styles.section, styles.leftSection]} />
          <View style={[styles.section, styles.rightSection]}>{rightContent}</View>
        </View>
      </SafeAreaView>
    </NavigationChromeSurface>
  );
}
