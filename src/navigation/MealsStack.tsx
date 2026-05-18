import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MealsScreen } from '../screens/meals/MealsScreen';
import { MealDetailsScreen } from '../screens/meals/MealDetailsScreen';
import { MealEditScreen } from '../screens/meals/MealEditScreen';
import type { MealsStackParamList } from './types';
import { useTheme } from '../design/ThemeContext';
import { createChromePushedStackScreenOptions } from '../ui/motion/navigation';

const Stack = createNativeStackNavigator<MealsStackParamList>();

export function MealsStack() {
  const theme = useTheme();
  const pushed = createChromePushedStackScreenOptions(theme);

  return (
    <Stack.Navigator
      screenOptions={{
        ...pushed,
      }}
    >
      <Stack.Screen
        name="MealsList"
        component={MealsScreen}
        options={{
          title: 'Meals',
          headerShown: false,
          headerLargeTitle: false,
        }}
      />
      <Stack.Screen
        name="MealDetails"
        component={MealDetailsScreen}
        options={{
          title: 'Meal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="MealEdit"
        component={MealEditScreen}
        options={({ route }) => ({
          title: route.params?.mealId ? 'Edit meal' : 'Add meal',
          headerShown: false,
        })}
      />
    </Stack.Navigator>
  );
}
