import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Keyboard,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../design/ThemeContext';
import { useSettingsScrollHandler } from '../../navigation/NavigationChromeScrollContext';
import { Screen } from '../../components/ui/Screen';
import { useSettingsScrollInsets } from './settingsScrollLayout';
import { KeyboardSafeForm } from '../../components/ui/KeyboardSafeForm';
import { TextField } from '../../components/ui/TextField';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { supabase, isSyncEnabled } from '../../services/supabaseClient';
import { spacing } from '../../design/spacing';

export function ChangePasswordScreen() {
  const theme = useTheme();
  const onScroll = useSettingsScrollHandler();
  const scrollInsets = useSettingsScrollInsets();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailProvider, setEmailProvider] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!isSyncEnabled()) {
          setEmailProvider(false);
          return;
        }
        const { data } = await supabase.auth.getUser();
        if (cancelled) return;
        const user = data.user;
        if (!user) {
          setEmailProvider(false);
          return;
        }
        const identities = user.identities ?? [];
        const emailIdentity = identities.some((i) => i.provider === 'email');
        setEmailProvider(emailIdentity);
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const onSubmit = async () => {
    Keyboard.dismiss();
    if (!isSyncEnabled()) return;
    if (emailProvider === false) return;

    if (!currentPassword || !newPassword) {
      Alert.alert('Missing fields', 'Enter your current password and a new password.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Password too short', 'Use at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'New password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      Alert.alert('Same password', 'Choose a different password than your current one.');
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user?.email;
    if (!email) {
      Alert.alert('Error', 'No email on file for this account.');
      return;
    }

    setLoading(true);
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (signInErr) {
        Alert.alert('Current password incorrect', signInErr.message);
        return;
      }

      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updateErr) {
        Alert.alert('Could not update password', updateErr.message);
        return;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Password updated', 'Use your new password next time you sign in on another device.');
    } finally {
      setLoading(false);
    }
  };

  if (!isSyncEnabled()) {
    return (
      <Screen padded safeTop={false} safeBottom={false}>
        <View
          style={[
            styles.center,
            {
              paddingTop: scrollInsets.paddingTop,
              paddingBottom: scrollInsets.paddingBottom,
            },
          ]}
        >
          <Text style={[theme.typography.body, { color: theme.textSecondary, textAlign: 'center' }]}>
            Password management is available when cloud sync is enabled and you are signed in with email.
          </Text>
        </View>
      </Screen>
    );
  }

  if (emailProvider === false) {
    return (
      <Screen padded safeTop={false} safeBottom={false}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: scrollInsets.paddingTop,
              paddingBottom: scrollInsets.paddingBottom,
            },
          ]}
          onScroll={onScroll}
          scrollEventThrottle={scrollInsets.scrollEventThrottle}
          contentInsetAdjustmentBehavior={scrollInsets.contentInsetBehavior}
        >
          <Text style={[theme.typography.body, { color: theme.textSecondary, lineHeight: 22 }]}>
            Password change applies to email sign-in only. If you use another sign-in provider, manage your account and
            password there.
          </Text>
        </ScrollView>
      </Screen>
    );
  }

  if (emailProvider === null && isSyncEnabled()) {
    return (
      <Screen padded safeTop={false} safeBottom={false}>
        <View
          style={[
            styles.centered,
            {
              paddingTop: scrollInsets.paddingTop,
              paddingBottom: scrollInsets.paddingBottom,
            },
          ]}
        >
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded safeTop={false} safeBottom={false}>
      <KeyboardSafeForm style={styles.flex}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: scrollInsets.paddingTop,
              paddingBottom: scrollInsets.paddingBottom,
            },
          ]}
          onScroll={onScroll}
          scrollEventThrottle={scrollInsets.scrollEventThrottle}
          contentInsetAdjustmentBehavior={scrollInsets.contentInsetBehavior}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[theme.typography.footnote, { color: theme.textSecondary, marginBottom: theme.spacing.lg }]}>
            Enter your current password, then choose a new one. You will stay signed in on this device.
          </Text>
          <TextField
            label="Current password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Current password"
            secureTextEntry
            autoCapitalize="none"
            containerStyle={styles.field}
          />
          <TextField
            label="New password"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="At least 6 characters"
            secureTextEntry
            autoCapitalize="none"
            containerStyle={styles.field}
          />
          <TextField
            label="Confirm new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-enter new password"
            secureTextEntry
            autoCapitalize="none"
            containerStyle={styles.field}
          />
          <PrimaryButton title="Update password" onPress={onSubmit} loading={loading} />
        </ScrollView>
      </KeyboardSafeForm>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flex: 1 },
  content: {},
  field: { marginBottom: spacing.md },
  center: { flex: 1, paddingHorizontal: spacing.lg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 120 },
});
