import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../design/ThemeContext';
import { tabRootHeaderHeight } from '../../design/layout';
import { NavigationChromeSurface } from '../../ui/chrome/NavigationChromeSurface';
import { RecipeSearchBar } from './RecipeSearchBar';

type RecipesHeaderProps = {
  searchQuery: string;
  onSearchChange: (text: string) => void;
};

/** Stack header: search only. Insets and chrome row match `ListScreenHeader` (Plan/Shop toggle). */
export function RecipesHeader({ searchQuery, onSearchChange }: RecipesHeaderProps) {
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
    <NavigationChromeSurface tabKey="RecipesStack">
      <View style={styles.safe}>
        <View style={styles.row}>
          <RecipeSearchBar
            value={searchQuery}
            onChangeText={onSearchChange}
            compact
          />
        </View>
      </View>
    </NavigationChromeSurface>
  );
}
