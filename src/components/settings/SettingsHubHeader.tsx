import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../design/ThemeContext';
import { NavigationChromeSurface } from '../../ui/chrome/NavigationChromeSurface';
import { RecipeSearchBar } from '../recipes/RecipeSearchBar';

type SettingsHubHeaderProps = {
  searchQuery: string;
  onSearchChange: (text: string) => void;
};

/** Profile tab root: search bar only — layout matches `RecipesHeader`. */
export function SettingsHubHeader({ searchQuery, onSearchChange }: SettingsHubHeaderProps) {
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
      }),
    [theme],
  );

  return (
    <NavigationChromeSurface tabKey="ProfileStack">
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.row}>
          <RecipeSearchBar
            value={searchQuery}
            onChangeText={onSearchChange}
            compact
            placeholder="Search settings"
          />
        </View>
      </SafeAreaView>
    </NavigationChromeSurface>
  );
}
