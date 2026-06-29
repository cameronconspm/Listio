import React, { useCallback } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RecipesStackParamList } from './types';
import { RecipesScreen } from '../screens/recipes/RecipesScreen';
import { RecipeDetailsScreen } from '../screens/recipes/RecipeDetailsScreen';
import { RecipeEditScreen } from '../screens/recipes/RecipeEditScreen';
import { useTheme } from '../design/ThemeContext';
import { createChromePushedStackScreenOptions } from '../ui/motion/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  createTabBarStackSyncListeners,
  syncTabBarWithStackDepth,
} from './syncTabBarWithStackDepth';

const Stack = createNativeStackNavigator<RecipesStackParamList>();

export function RecipesStack() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const pushed = createChromePushedStackScreenOptions(theme);

  const syncTabBar = useCallback(
    (navigation: Parameters<typeof syncTabBarWithStackDepth>[0]) => {
      syncTabBarWithStackDepth(navigation, insets.bottom);
    },
    [insets.bottom],
  );

  return (
    <Stack.Navigator
      screenOptions={{
        ...pushed,
      }}
      screenListeners={({ navigation }) => createTabBarStackSyncListeners(() => syncTabBar(navigation))}
    >
      <Stack.Screen
        name="RecipesList"
        component={RecipesScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="RecipeDetails"
        component={RecipeDetailsScreen}
        options={{
          title: 'Recipe',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="RecipeEdit"
        component={RecipeEditScreen}
        options={({ route }) => ({
          title: route.params?.recipeId ? 'Edit recipe' : 'New recipe',
          headerShown: false,
        })}
      />
    </Stack.Navigator>
  );
}
