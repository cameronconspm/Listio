import React, { useCallback } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MealsScreen } from '../screens/meals/MealsScreen';
import { MealDetailsScreen } from '../screens/meals/MealDetailsScreen';
import { MealEditScreen } from '../screens/meals/MealEditScreen';
import type { MealsStackParamList } from './types';
import { useTheme } from '../design/ThemeContext';
import { createChromePushedStackScreenOptions } from '../ui/motion/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  createTabBarStackSyncListeners,
  syncTabBarWithStackDepth,
} from './syncTabBarWithStackDepth';

const Stack = createNativeStackNavigator<MealsStackParamList>();

export function MealsStack() {
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
