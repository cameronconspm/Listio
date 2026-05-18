import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../design/ThemeContext';
import { tabRootHeaderHeight } from '../../design/layout';
import { NavigationChromeSurface } from '../../ui/chrome/NavigationChromeSurface';
import { RecipeSearchBar } from '../recipes/RecipeSearchBar';

type SettingsHubHeaderProps = {
  searchQuery: string;
  onSearchChange: (text: string) => void;
};

/** Profile tab root: search bar only — layout matches `RecipesHeader`. */
export function SettingsHubHeader({ searchQuery, onSearchChange }: SettingsHubHeaderProps) {
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
      }),
    [insets.top, theme],
  );

  return (
    <NavigationChromeSurface tabKey="ProfileStack">
      <View style={styles.safe}>
        <View style={styles.row}>
          <RecipeSearchBar
            value={searchQuery}
            onChangeText={onSearchChange}
            compact
            placeholder="Search settings"
          />
        </View>
      </View>
    </NavigationChromeSurface>
  );
}
