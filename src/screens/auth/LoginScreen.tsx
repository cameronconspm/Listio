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
import {
  authCardAfterHeroStyle,
  authFieldBeforeLinkStyle,
  authFieldContainerStyle,
  authFooterLinkStyle,
  authForgotLinkStyle,
} from '../../design/authLayout';
import { SignInValueStrip } from '../../components/auth/SignInValueStrip';
import { AuthProviderStack } from '../../components/auth/AuthProviderStack';
import { AppleSignInButton } from '../../components/auth/AppleSignInButton';
import { signInWithApple } from '../../services/appleSignInService';
import { logFunnelEvent } from '../../services/funnelAnalyticsService';
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
  const onboardingLayout = useMemo(
    () => createOnboardingLayout(theme.spacing, theme.layoutScale),
    [theme],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1 },
        container: { flex: 1 },
        fadeContent: { flex: 1 },
        scroll: { flexGrow: 1 },
      }),
    [],
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
        'Listio isn’t set up on this device yet. Check your connection or reinstall from the App Store.'
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
      logFunnelEvent('auth_login_success', { method: 'email' });
      // Session listener in App will switch to AppTabs
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Login failed';
      setError(
        msg.includes('Network') || msg.includes('fetch')
          ? 'Network error. Check your connection and try again.'
          : msg
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await signInWithApple();
      if (!result.ok && !result.cancelled && result.message) {
        setError(result.message);
      }
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
              Your beautiful grocery list, sorted by store aisle. Shop mode keeps you moving — meals and recipes connect when you want them.
            </Text>

            <Text style={[theme.typography.footnote, { color: theme.textSecondary, marginBottom: theme.spacing.md }]}>
              Built for iPhone · Private by default
            </Text>

            <SignInValueStrip />

            <Card style={authCardAfterHeroStyle}>
              <TextField
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                error={error ?? undefined}
                containerStyle={authFieldContainerStyle}
              />
              <TextField
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
                containerStyle={authFieldBeforeLinkStyle}
              />
              <TouchableOpacity
                onPress={() => navigation.navigate('ForgotPassword')}
                style={authForgotLinkStyle}
                activeOpacity={0.7}
                accessibilityRole="button"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[theme.typography.footnote, { color: theme.accent }]}>Forgot password?</Text>
              </TouchableOpacity>
              <Button title="Log in" onPress={handleLogin} loading={loading} />
              <AuthProviderStack>
                <AppleSignInButton
                  title="Sign in with Apple"
                  onPress={() => void handleAppleSignIn()}
                  disabled={loading}
                />
              </AuthProviderStack>
            </Card>
            <TouchableOpacity
              onPress={() => navigation.navigate('Signup')}
              style={authFooterLinkStyle}
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
