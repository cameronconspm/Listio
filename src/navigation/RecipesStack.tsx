import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RecipesStackParamList } from './types';
import { RecipesScreen } from '../screens/recipes/RecipesScreen';
import { RecipeDetailsScreen } from '../screens/recipes/RecipeDetailsScreen';
import { RecipeEditScreen } from '../screens/recipes/RecipeEditScreen';
import { useTheme } from '../design/ThemeContext';
import { createTranslucentStackScreenOptions } from '../ui/motion/navigation';
import { ChromeStackHeaderBackground } from '../ui/chrome/ChromeStackHeaderBackground';

const Stack = createNativeStackNavigator<RecipesStackParamList>();

export function RecipesStack() {
  const theme = useTheme();
  const base = createTranslucentStackScreenOptions(theme);

  return (
    <Stack.Navigator
      screenOptions={{
        ...base,
        headerShown: true,
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen
        name="RecipesList"
        component={RecipesScreen}
        options={{ headerShown: true }}
      />
      <Stack.Screen
        name="RecipeDetails"
        component={RecipeDetailsScreen}
        options={{
          title: 'Recipe',
          headerBackground: () => <ChromeStackHeaderBackground />,
          headerBlurEffect: 'none',
        }}
      />
      <Stack.Screen
        name="RecipeEdit"
        component={RecipeEditScreen}
        options={({ route }) => ({
          title: route.params?.recipeId ? 'Edit recipe' : 'New recipe',
          headerBackground: () => <ChromeStackHeaderBackground />,
          headerBlurEffect: 'none',
        })}
      />
    </Stack.Navigator>
  );
}
