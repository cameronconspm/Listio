import React from 'react';
import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import type { SettingsStackParamList } from './types';
import { useTheme, type AppTheme } from '../design/ThemeContext';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { ProfileScreen } from '../screens/settings/ProfileScreen';
import { ChangePasswordScreen } from '../screens/settings/ChangePasswordScreen';
import { PlanScreen } from '../screens/settings/PlanScreen';
import { NotificationsScreen } from '../screens/settings/NotificationsScreen';
import { ThemePreferencesScreen } from '../screens/settings/ThemePreferencesScreen';
import { OnboardingScreen } from '../screens/settings/OnboardingScreen';
import { PrivacyTermsScreen } from '../screens/settings/PrivacyTermsScreen';
import { DeleteAccountScreen } from '../screens/settings/DeleteAccountScreen';
import { SettingsPlaceholderScreen } from '../screens/settings/SettingsPlaceholderScreen';
import { HeaderIconButton } from '../components/ui/HeaderIconButton';
import { createTranslucentStackScreenOptions } from '../ui/motion/navigation';
import { SettingsStackHeaderChrome } from '../ui/chrome/SettingsStackHeaderChrome';
import { SettingsStackPresentationContext } from './NavigationChromeScrollContext';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

const headerOptions = (theme: AppTheme) => ({
  headerTitleAlign: 'center' as const,
  headerBackButtonDisplayMode: 'minimal' as const,
  headerTintColor: theme.textPrimary,
  headerTitleStyle: { fontWeight: '600' as const, fontSize: 17 },
});

export type SettingsStackProps = {
  /** `tab`: bottom-tab Profile (no modal back on hub). `modal`: unused; retained for API compatibility. */
  hubPresentation?: 'modal' | 'tab';
};

export function SettingsStack({ hubPresentation = 'modal' }: SettingsStackProps) {
  const theme = useTheme();
  const translucent = createTranslucentStackScreenOptions(theme);

  return (
    <SettingsStackPresentationContext.Provider value={hubPresentation}>
      <Stack.Navigator
        screenOptions={{
          ...translucent,
          ...headerOptions(theme),
          headerBackground: () => <SettingsStackHeaderChrome />,
          ...(Platform.OS === 'ios' ? { headerBlurEffect: undefined } : {}),
        }}
      >
        <Stack.Screen
          name="SettingsHub"
          component={SettingsScreen}
          options={({ navigation }) => ({
            title: hubPresentation === 'tab' ? '' : 'Settings',
            headerShown: true,
            headerLeft:
              hubPresentation === 'tab'
                ? undefined
                : () => (
                    <HeaderIconButton
                      accessibilityLabel="Back"
                      onPress={() =>
                        (navigation.getParent() as { goBack: () => void } | undefined)?.goBack()
                      }
                    >
                      <Ionicons name="chevron-back" size={28} color={theme.textPrimary} />
                    </HeaderIconButton>
                  ),
          })}
        />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Change password' }} />
      <Stack.Screen name="Plan" component={PlanScreen} options={{ title: 'Plan' }} />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Notifications' }}
      />
      <Stack.Screen
        name="ThemePreferences"
        component={ThemePreferencesScreen}
        options={{ title: 'Theme' }}
      />
      <Stack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        options={{ title: 'Onboarding' }}
      />
      <Stack.Screen
        name="PrivacyTerms"
        component={PrivacyTermsScreen}
        options={{ title: 'Privacy & terms' }}
      />
      <Stack.Screen
        name="DeleteAccount"
        component={DeleteAccountScreen}
        options={{ title: 'Delete account' }}
      />
      <Stack.Screen
        name="SettingsPlaceholder"
        component={SettingsPlaceholderScreen}
        options={({ route }) => ({ title: route.params?.title ?? 'Settings' })}
      />
      </Stack.Navigator>
    </SettingsStackPresentationContext.Provider>
  );
}
