import React, { useState } from 'react';
import { Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { AuthStackScreenProps } from '../../navigation/types';
import { useTheme } from '../../design/ThemeContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { KeyboardSafeForm } from '../../components/ui/KeyboardSafeForm';
import { supabase } from '../../services/supabaseClient';
import { spacing } from '../../design/spacing';

type Props = AuthStackScreenProps<'Signup'>;

export function SignupScreen(_props: Props) {
  const navigation = useNavigation<Props['navigation']>();
  const theme = useTheme();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Email and password are required');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim() || undefined,
          },
        },
      });
      if (err) {
        setError(err.message ?? 'Sign up failed');
        return;
      }
      // Session listener in App will switch to AppTabs
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign up failed');
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
          Create account
        </Text>
        <Text style={[theme.typography.body, { color: theme.textSecondary, marginBottom: theme.spacing.xl }]}>
          Enter your email and a password
        </Text>
        <Card style={styles.card}>
          <TextField
            label="Display name (optional)"
            value={fullName}
            onChangeText={setFullName}
            placeholder="How we should address you"
            autoCapitalize="words"
            containerStyle={styles.nameField}
          />
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
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            secureTextEntry
          />
          <Button title="Sign up" onPress={handleSignup} loading={loading} />
        </Card>
        <TouchableOpacity
          onPress={() => navigation.navigate('Login')}
          style={styles.link}
          activeOpacity={0.7}
        >
          <Text style={[theme.typography.callout, { color: theme.accent }]}>
            Already have an account? Log in
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardSafeForm>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg, paddingTop: 80 },
  card: { marginBottom: spacing.lg },
  nameField: { marginBottom: spacing.sm },
  link: { alignSelf: 'center' },
});
