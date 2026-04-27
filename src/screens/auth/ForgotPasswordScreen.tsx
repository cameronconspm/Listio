import React, { useState } from 'react';
import { Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { AuthStackScreenProps } from '../../navigation/types';
import { useTheme } from '../../design/ThemeContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { KeyboardSafeForm } from '../../components/ui/KeyboardSafeForm';
import { supabase, isSupabaseConfigured } from '../../services/supabaseClient';
import { getPasswordResetRedirectTo } from '../../services/authDeepLink';
import { spacing } from '../../design/spacing';

type Props = AuthStackScreenProps<'ForgotPassword'>;

export function ForgotPasswordScreen(_props: Props) {
  const navigation = useNavigation<Props['navigation']>();
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSendLink = async () => {
    setError(null);
    if (!isSupabaseConfigured()) {
      setError(
        'Supabase not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env'
      );
      return;
    }
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Enter the email for your account');
      return;
    }
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: getPasswordResetRedirectTo(),
      });
      if (err) {
        setError(err.message ?? 'Could not send reset email');
        return;
      }
      setSent(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not send reset email';
      setError(
        msg.includes('Network') || msg.includes('fetch')
          ? 'Network error. Check your connection and Supabase settings.'
          : msg
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardSafeForm style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[theme.typography.largeTitle, { color: theme.textPrimary, marginBottom: theme.spacing.lg }]}>
          Reset password
        </Text>
        <Text style={[theme.typography.body, { color: theme.textSecondary, marginBottom: theme.spacing.xl }]}>
          {sent
            ? `If an account exists for ${email.trim()}, you will receive an email with a link to choose a new password.`
            : 'We will email you a link to reset your password.'}
        </Text>
        {!sent ? (
          <Card style={styles.card}>
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              error={error ?? undefined}
            />
            <Button title="Send reset link" onPress={handleSendLink} loading={loading} />
          </Card>
        ) : null}
        <TouchableOpacity
          onPress={() => navigation.navigate('Login')}
          style={styles.link}
          activeOpacity={0.7}
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[theme.typography.callout, { color: theme.accent }]}>Back to sign in</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardSafeForm>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg, paddingTop: 80 },
  card: { marginBottom: spacing.lg },
  link: {
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
});
