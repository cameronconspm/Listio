import React from 'react';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/ThemeContext';
import { AuthProviderButton } from './AuthProviderButton';

type AppleSignInButtonProps = {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Defaults to “Sign in with Apple”. Use “Sign up with Apple” on signup. */
  title?: string;
};

/** Sign in with Apple — iOS only; uses app secondary button chrome + Apple logo. */
export function AppleSignInButton({
  onPress,
  disabled = false,
  loading = false,
  title = 'Sign in with Apple',
}: AppleSignInButtonProps) {
  const theme = useTheme();

  if (Platform.OS !== 'ios') return null;

  return (
    <AuthProviderButton
      title={title}
      onPress={onPress}
      disabled={disabled}
      loading={loading}
      icon={<Ionicons name="logo-apple" size={20} color={theme.textPrimary} />}
    />
  );
}
