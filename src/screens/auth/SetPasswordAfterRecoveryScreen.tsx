import React, { useState } from 'react';
import { Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useTheme } from '../../design/ThemeContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { KeyboardSafeForm } from '../../components/ui/KeyboardSafeForm';
import { supabase } from '../../services/supabaseClient';
import { spacing } from '../../design/spacing';

type Props = {
  onFinished: () => void;
};

export function SetPasswordAfterRecoveryScreen({ onFinished }: Props) {
  const theme = useTheme();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!password || !confirm) {
      setError('Enter and confirm your new password');
      return;
    }
    if (password.length < 6) {
      setError('Use at least 6 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) {
        setError(updateErr.message ?? 'Could not update password');
        return;
      }
      Alert.alert('Password updated', 'You can continue using Listio with your new password.', [
        { text: 'OK', onPress: onFinished },
      ]);
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
          Choose a new password
        </Text>
        <Text style={[theme.typography.body, { color: theme.textSecondary, marginBottom: theme.spacing.xl }]}>
          Your email link worked. Set a new password for your account.
        </Text>
        <Card style={styles.card}>
          <TextField
            label="New password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            secureTextEntry
            containerStyle={styles.field}
          />
          <TextField
            label="Confirm password"
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Re-enter password"
            secureTextEntry
            error={error ?? undefined}
          />
          <Button title="Update password" onPress={handleSubmit} loading={loading} />
        </Card>
      </ScrollView>
    </KeyboardSafeForm>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg, paddingTop: 80 },
  card: { marginBottom: spacing.lg },
  field: { marginBottom: spacing.md },
});
