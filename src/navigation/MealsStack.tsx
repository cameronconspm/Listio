import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MealsScreen } from '../screens/meals/MealsScreen';
import { MealDetailsScreen } from '../screens/meals/MealDetailsScreen';
import { MealEditScreen } from '../screens/meals/MealEditScreen';
import type { MealsStackParamList } from './types';
import { useTheme } from '../design/ThemeContext';
import { createTranslucentStackScreenOptions } from '../ui/motion/navigation';
import { ChromeStackHeaderBackground } from '../ui/chrome/ChromeStackHeaderBackground';

const Stack = createNativeStackNavigator<MealsStackParamList>();

export function MealsStack() {
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
        name="MealsList"
        component={MealsScreen}
        options={{
          title: 'Meals',
          headerLargeTitle: false,
        }}
      />
      <Stack.Screen
        name="MealDetails"
        component={MealDetailsScreen}
        options={{
          title: 'Meal',
          headerBackground: () => <ChromeStackHeaderBackground />,
          headerBlurEffect: 'none',
        }}
      />
      <Stack.Screen
        name="MealEdit"
        component={MealEditScreen}
        options={({ route }) => ({
          title: route.params?.mealId ? 'Edit meal' : 'Add meal',
          headerBackground: () => <ChromeStackHeaderBackground />,
          headerBlurEffect: 'none',
        })}
      />
    </Stack.Navigator>
  );
}
