import React from 'react';
import { KeyboardAvoidingView, Platform, type ViewStyle, type StyleProp } from 'react-native';

type Props = {
  children: React.ReactNode;
  /** Default matches existing settings/store edit forms: flex 1 + iOS padding behavior. */
  style?: StyleProp<ViewStyle>;
  keyboardVerticalOffset?: number;
};

/**
 * Shared KeyboardAvoidingView shell for scrollable forms (Profile, Store edit, auth, etc.).
 * Preserves the app’s existing `behavior` / `keyboardVerticalOffset` defaults.
 */
export function KeyboardSafeForm({
  children,
  style,
  keyboardVerticalOffset = 0,
}: Props) {
  return (
    <KeyboardAvoidingView
      style={[{ flex: 1 }, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
