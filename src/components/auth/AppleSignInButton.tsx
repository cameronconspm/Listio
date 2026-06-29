import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useTheme } from '../../design/ThemeContext';

type AppleSignInButtonProps = {
  onPress: () => void;
  disabled?: boolean;
};

/** Native Sign in with Apple button — iOS only. */
export function AppleSignInButton({ onPress, disabled = false }: AppleSignInButtonProps) {
  const theme = useTheme();

  if (Platform.OS !== 'ios') return null;

  return (
    <View style={[styles.wrap, { marginBottom: theme.spacing.md }]}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={
          theme.colorScheme === 'dark'
            ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
            : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
        }
        cornerRadius={theme.radius.full}
        style={styles.button}
        onPress={onPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  button: { width: '100%', height: 44 },
});
