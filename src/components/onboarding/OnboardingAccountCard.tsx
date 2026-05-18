import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/ThemeContext';
import { SecondaryButton } from '../ui/SecondaryButton';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';

type Props = {
  syncEnabled: boolean;
  email: string | null;
  loading: boolean;
  onHowToEnableSync: () => void;
};

export function OnboardingAccountCard({ syncEnabled, email, loading, onHowToEnableSync }: Props) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.divider,
        },
        theme.shadows.card,
      ]}
    >
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: theme.accent + '22' }]}>
          {loading ? (
            <ActivityIndicator size="small" color={theme.accent} />
          ) : (
            <Ionicons name="person" size={22} color={theme.accent} accessibilityLabel="Account" />
          )}
        </View>
        <View style={styles.textCol}>
          <Text style={[theme.typography.caption1, { color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 }]}>
            {syncEnabled ? 'Your account' : 'This device'}
          </Text>
          {syncEnabled ? (
            loading ? (
              <Text style={[theme.typography.body, { color: theme.textPrimary, marginTop: theme.spacing.xxs }]}>…</Text>
            ) : (
              <Text style={[theme.typography.body, { color: theme.textPrimary, marginTop: theme.spacing.xxs, fontWeight: '600' }]}>
                {email ? `Signed in as ${email}` : 'Signed in'}
              </Text>
            )
          ) : (
            <Text style={[theme.typography.subhead, { color: theme.textSecondary, marginTop: theme.spacing.xxs }]}>
              Not signed in yet.
            </Text>
          )}
        </View>
      </View>
      <Text style={[theme.typography.subhead, { color: theme.textSecondary, marginTop: theme.spacing.md, lineHeight: 21 }]}>
        {syncEnabled
          ? 'Your list, meals, and recipes are available on every device where you’re signed in.'
          : 'Sign in to keep your list, meals, and recipes with your account.'}
      </Text>
      {!syncEnabled ? (
        <SecondaryButton title="Sign in" onPress={onHowToEnableSync} style={styles.btn} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1, marginLeft: spacing.md, minWidth: 0 },
  btn: { marginTop: spacing.md },
});
