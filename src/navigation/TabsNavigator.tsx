import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { PlatformPressable } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { TabsParamList } from './types';
import { HomeStack } from './HomeStack';
import { MealsStack } from './MealsStack';
import { RecipesStack } from './RecipesStack';
import { ProfileStack } from './ProfileStack';
import { useTheme } from '../design/ThemeContext';
import { TabBarBlurBackground } from './TabBarBlurBackground';
import { createTabBarStyleVisible } from './tabBarLayout';
const Tabs = createBottomTabNavigator<TabsParamList>();

export function TabsNavigator() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // Required for BlurView: bar must overlay the scene so content scrolls beneath
  // and the blur has something real to sample (see tabBarBackground in bottom-tabs types).
  const tabBarStyleVisible = createTabBarStyleVisible(insets.bottom);

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
        options={{
          title: 'Meals',
          tabBarLabel: 'Meals',
          tabBarButton: (props) => <PlatformPressable {...props} />,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="restaurant-outline" size={size ?? 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="RecipesStack"
        component={RecipesStack}
        options={{
          title: 'Recipes',
          tabBarLabel: 'Recipes',
          tabBarButton: (props) => <PlatformPressable {...props} />,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="book-outline" size={size ?? 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ProfileStack"
        component={ProfileStack}
        listeners={({ navigation, route }) => ({
          tabPress: () => {
            const nestedRoute = getFocusedRouteNameFromRoute(route);
            if (nestedRoute != null && nestedRoute !== 'SettingsHub') {
              navigation.navigate('ProfileStack', { screen: 'SettingsHub' });
            }
          },
        })}
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" size={size ?? 24} color={color} />
          ),
        }}
      />
    </Tabs.Navigator>
  );
}
