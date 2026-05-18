import React, { useCallback, useRef, useState } from 'react';
import { View, StyleSheet, Image, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../design/ThemeContext';
import type { AuthStackParamList } from '../../navigation/types';
import { onboardingPageGradient } from '../onboarding/onboardingTokens';
import { useReduceMotion } from '../../ui/motion/useReduceMotion';
import { hasSeenWelcomeIntro } from '../../services/welcomeIntroService';

const LOGO_HOLD_MS = 1000;
const LOGO_FADE_MS = 480;

type Nav = NativeStackNavigationProp<AuthStackParamList, 'AuthSplash'>;

export function AuthSplashScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const reduceMotion = useReduceMotion();
  const isDark = theme.colorScheme === 'dark';
  const gradientColors = isDark ? onboardingPageGradient.dark : onboardingPageGradient.light;
  const logoOpacity = useRef(new Animated.Value(1)).current;
  const [showBrandedLogo, setShowBrandedLogo] = useState(false);

  const goToNextScreen = useCallback(
    (target: 'Login' | 'WelcomeIntro') => {
      navigation.replace(target);
    },
    [navigation]
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const holdTimeouts: ReturnType<typeof setTimeout>[] = [];
      logoOpacity.setValue(1);
      setShowBrandedLogo(false);

      const clearTimers = () => {
        holdTimeouts.forEach(clearTimeout);
        holdTimeouts.length = 0;
        logoOpacity.stopAnimation();
      };

      /**
       * Resolve welcome-intro state first. First-time installs replace straight to
       * WelcomeIntro with no logo hold. Returning users get the branded logo → Login
       * handoff after the hold/fade.
       *
       * If the AsyncStorage read fails, default to Login so the auth flow never wedges.
       */
      void hasSeenWelcomeIntro()
        .then((seen) => {
          if (cancelled) return;
          if (!seen) {
            goToNextScreen('WelcomeIntro');
            return;
          }
          setShowBrandedLogo(true);
          if (reduceMotion) {
            const t = setTimeout(() => {
              if (cancelled) return;
              goToNextScreen('Login');
            }, LOGO_HOLD_MS);
            holdTimeouts.push(t);
          } else {
            const holdId = setTimeout(() => {
              if (cancelled) return;
              Animated.timing(logoOpacity, {
                toValue: 0,
                duration: LOGO_FADE_MS,
                useNativeDriver: true,
              }).start(({ finished }) => {
                if (cancelled || !finished) return;
                goToNextScreen('Login');
              });
            }, LOGO_HOLD_MS);
            holdTimeouts.push(holdId);
          }
        })
        .catch(() => {
          if (cancelled) return;
          goToNextScreen('Login');
        });

      return () => {
        cancelled = true;
        clearTimers();
      };
    }, [goToNextScreen, logoOpacity, reduceMotion])
  );

  return (
    <View style={styles.root}>
      <LinearGradient colors={[...gradientColors]} style={StyleSheet.absoluteFillObject} />
      <View style={styles.center}>
        {showBrandedLogo ? (
          <Animated.View style={[styles.logoWrap, { opacity: logoOpacity }]} accessibilityRole="image" accessibilityLabel="Listio">
            <Image source={require('../../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    width: 120,
    height: 120,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
});
