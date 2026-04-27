import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { TabsParamList } from './types';
import { HomeStack } from './HomeStack';
import { MealsStack } from './MealsStack';
import { RecipesStack } from './RecipesStack';
import { ProfileStack } from './ProfileStack';
import { useTheme } from '../design/ThemeContext';
import { TabBarBlurBackground } from './TabBarBlurBackground';
const Tabs = createBottomTabNavigator<TabsParamList>();

/** Apple HIG: tab bar content height 49pt + safe area */
const TAB_BAR_CONTENT_HEIGHT = 49;

export function TabsNavigator() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // Required for BlurView: bar must overlay the scene so content scrolls beneath
  // and the blur has something real to sample (see tabBarBackground in bottom-tabs types).
  const tabBarStyleVisible = {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 0,
    paddingTop: 0,
    backgroundColor: 'transparent',
    elevation: 0,
    shadowOpacity: 0,
    height: TAB_BAR_CONTENT_HEIGHT + insets.bottom,
  };

  const tabBarStyleHidden = { display: 'none' as const };

  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarBackground: () => <TabBarBlurBackground />,
        tabBarStyle: tabBarStyleVisible,
      }}
    >
      <Tabs.Screen
        name="ListTab"
        component={HomeStack}
        options={{
          title: 'List',
          tabBarLabel: 'List',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list" size={size ?? 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="MealsStack"
        component={MealsStack}
        options={({ route }) => {
          const focused = getFocusedRouteNameFromRoute(route) ?? 'MealsList';
          const hideTabBar = focused !== 'MealsList';
          return {
            title: 'Meals',
            tabBarLabel: 'Meals',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="restaurant-outline" size={size ?? 24} color={color} />
            ),
            tabBarStyle: hideTabBar ? tabBarStyleHidden : tabBarStyleVisible,
          };
        }}
      />
      <Tabs.Screen
        name="RecipesStack"
        component={RecipesStack}
        options={({ route }) => {
          const focused = getFocusedRouteNameFromRoute(route) ?? 'RecipesList';
          const hideTabBar = focused !== 'RecipesList';
          return {
            title: 'Recipes',
            tabBarLabel: 'Recipes',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="book-outline" size={size ?? 24} color={color} />
            ),
            tabBarStyle: hideTabBar ? tabBarStyleHidden : tabBarStyleVisible,
          };
        }}
      />
      <Tabs.Screen
        name="ProfileStack"
        component={ProfileStack}
        options={({ route }) => {
          const focused = getFocusedRouteNameFromRoute(route) ?? 'SettingsHub';
          const hideTabBar = focused !== 'SettingsHub';
          return {
            title: 'Profile',
            tabBarLabel: 'Profile',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-circle-outline" size={size ?? 24} color={color} />
            ),
            tabBarStyle: hideTabBar ? tabBarStyleHidden : tabBarStyleVisible,
          };
        }}
      />
    </Tabs.Navigator>
  );
}
