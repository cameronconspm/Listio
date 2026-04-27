import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Text, StyleSheet, TouchableOpacity, ScrollView, View, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { AuthStackScreenProps } from '../../navigation/types';
import { useTheme } from '../../design/ThemeContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { KeyboardSafeForm } from '../../components/ui/KeyboardSafeForm';
import { supabase, isSupabaseConfigured } from '../../services/supabaseClient';
import { createOnboardingLayout, onboardingPageGradient } from '../onboarding/onboardingTokens';
import { SignInValueStrip } from '../../components/auth/SignInValueStrip';
import { useReduceMotion } from '../../ui/motion/useReduceMotion';

const LOGIN_CONTENT_FADE_MS = 420;

type Props = AuthStackScreenProps<'Login'>;

export function LoginScreen(_props: Props) {
  const navigation = useNavigation<Props['navigation']>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const contentOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isDark = theme.colorScheme === 'dark';
  const gradientColors = isDark ? onboardingPageGradient.dark : onboardingPageGradient.light;
  const onboardingLayout = useMemo(() => createOnboardingLayout(theme.spacing), [theme]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1 },
        container: { flex: 1 },
        fadeContent: { flex: 1 },
        scroll: { flexGrow: 1 },
        card: { marginTop: theme.spacing.md, marginBottom: theme.spacing.lg },
        forgotRow: {
          alignSelf: 'flex-end',
          minHeight: 44,
          justifyContent: 'center',
          marginBottom: theme.spacing.md,
          paddingVertical: 0,
        },
        link: {
          alignSelf: 'center',
          minHeight: 44,
          justifyContent: 'center',
          paddingVertical: theme.spacing.sm,
        },
      }),
    [theme],
  );

  useEffect(() => {
    if (reduceMotion) {
      contentOpacity.setValue(1);
      return;
    }
    contentOpacity.setValue(0);
    const anim = Animated.timing(contentOpacity, {
      toValue: 1,
      duration: LOGIN_CONTENT_FADE_MS,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [contentOpacity, reduceMotion]);

  const handleLogin = async () => {
    setError(null);
    if (!isSupabaseConfigured()) {
      setError(
        'Supabase not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env'
      );
      return;
    }
    if (!email.trim() || !password) {
      setError('Email and password are required');
      return;
    }
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (err) {
        setError(err.message ?? 'Login failed');
        return;
      }
      // Session listener in App will switch to AppTabs
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Login failed';
      setError(
        msg.includes('Network') || msg.includes('fetch')
          ? 'Network error. Check .env has valid Supabase URL and restart the app.'
          : msg
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={[...gradientColors]} style={StyleSheet.absoluteFillObject} />
      <KeyboardSafeForm style={[styles.container, { backgroundColor: 'transparent' }]}>
        <Animated.View style={[styles.fadeContent, { opacity: contentOpacity }]}>
          <ScrollView
            contentContainerStyle={[
              styles.scroll,
              {
                paddingTop: insets.top + theme.spacing.lg,
                paddingHorizontal: onboardingLayout.horizontalPadding,
                paddingBottom: insets.bottom + theme.spacing.xl,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={[theme.typography.title1, { color: theme.textPrimary, marginBottom: theme.spacing.sm }]}>
              Sign in
            </Text>
            <Text
              style={[
                theme.typography.body,
                {
                  color: theme.textSecondary,
                  lineHeight: 24,
                  marginBottom: theme.spacing.md,
                },
              ]}
            >
              Plan what you are cooking, send recipe ingredients to your list, and shop aisle by aisle.
            </Text>

            <SignInValueStrip />

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
              <TextField
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
                containerStyle={{ marginBottom: theme.spacing.xs }}
              />
              <TouchableOpacity
                onPress={() => navigation.navigate('ForgotPassword')}
                style={styles.forgotRow}
                activeOpacity={0.7}
                accessibilityRole="button"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[theme.typography.footnote, { color: theme.accent }]}>Forgot password?</Text>
              </TouchableOpacity>
              <Button title="Log in" onPress={handleLogin} loading={loading} />
            </Card>
            <TouchableOpacity
              onPress={() => navigation.navigate('Signup')}
              style={styles.link}
              activeOpacity={0.7}
            >
              <Text style={[theme.typography.callout, { color: theme.accent }]}>
                Don’t have an account? Sign up
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </KeyboardSafeForm>
    </View>
  );
}
