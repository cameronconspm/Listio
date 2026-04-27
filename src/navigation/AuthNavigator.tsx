import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AuthStackParamList } from './types';
import { AuthSplashScreen } from '../screens/auth/AuthSplashScreen';
import { WelcomeIntroScreen } from '../screens/auth/WelcomeIntroScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { useTheme } from '../design/ThemeContext';
import { createNativeStackScreenOptions } from '../ui/motion/navigation';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  const theme = useTheme();
  const base = createNativeStackScreenOptions(theme);

  return (
    <Stack.Navigator
      initialRouteName="AuthSplash"
      screenOptions={{
        ...base,
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <Stack.Screen name="AuthSplash" component={AuthSplashScreen} />
      <Stack.Screen name="WelcomeIntro" component={WelcomeIntroScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
}
