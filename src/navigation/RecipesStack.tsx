import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RecipesStackParamList } from './types';
import { RecipesScreen } from '../screens/recipes/RecipesScreen';
import { RecipeDetailsScreen } from '../screens/recipes/RecipeDetailsScreen';
import { RecipeEditScreen } from '../screens/recipes/RecipeEditScreen';
import { useTheme } from '../design/ThemeContext';
import { createChromePushedStackScreenOptions } from '../ui/motion/navigation';

const Stack = createNativeStackNavigator<RecipesStackParamList>();

export function RecipesStack() {
  const theme = useTheme();
  const pushed = createChromePushedStackScreenOptions(theme);

  return (
    <Stack.Navigator
      screenOptions={{
        ...pushed,
      }}
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
