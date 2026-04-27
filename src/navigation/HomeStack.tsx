import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/home/HomeScreen';
import { useTheme } from '../design/ThemeContext';
import { createTranslucentStackScreenOptions } from '../ui/motion/navigation';

const Stack = createNativeStackNavigator();

export function HomeStack() {
  const theme = useTheme();
  const base = createTranslucentStackScreenOptions(theme);

  return (
    <Stack.Navigator
      screenOptions={{
        ...base,
        headerLargeTitle: false,
        headerTitle: 'List',
      }}
    >
      <Stack.Screen name="List" component={HomeScreen} />
    </Stack.Navigator>
  );
}
