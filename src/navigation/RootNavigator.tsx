import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { TabsNavigator } from './TabsNavigator';
import { useTheme } from '../design/ThemeContext';
import { createNativeStackScreenOptions } from '../ui/motion/navigation';
import { NavigationChromeScrollProvider } from './NavigationChromeScrollContext';
import { useNotificationBootstrap } from '../hooks/useNotificationBootstrap';

const Stack = createNativeStackNavigator<RootStackParamList>();

/** Main app: tabs + settings modal. Auth and onboarding are handled above this navigator in `App.tsx`. */
export function RootNavigator() {
  useNotificationBootstrap();
  const theme = useTheme();
  const base = createNativeStackScreenOptions(theme);
  return (
    <NavigationChromeScrollProvider>
      <Stack.Navigator
        screenOptions={{
          ...base,
          headerShown: false,
        }}
      >
        <Stack.Screen name="AppTabs" component={TabsNavigator} />
      </Stack.Navigator>
    </NavigationChromeScrollProvider>
  );
}
