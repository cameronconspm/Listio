import React, { useCallback, useRef } from 'react';
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

  const goToNextScreen = useCallback(
    (target: 'Login' | 'WelcomeIntro') => {
      navigation.replace(target);
    },
    [navigation]
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      logoOpacity.setValue(1);

      /**
       * Decide the next screen before kicking off the hold/fade. First-time users
       * go straight to the welcome intro; returning users see the familiar
       * branded logo → Login handoff.
       *
       * If the AsyncStorage read stalls, default to Login so the auth flow
       * never wedges on a missing flag.
       */
      let targetRef: 'Login' | 'WelcomeIntro' = 'Login';
      const targetPromise = hasSeenWelcomeIntro()
        .then((seen) => {
          if (!seen) targetRef = 'WelcomeIntro';
        })
        .catch(() => {
          /* default to Login — already captured */
        });

      let clearHold: () => void = () => {};
      if (reduceMotion) {
        const t = setTimeout(() => {
          if (cancelled) return;
          void targetPromise.then(() => {
            if (!cancelled) goToNextScreen(targetRef);
          });
        }, LOGO_HOLD_MS);
        clearHold = () => clearTimeout(t);
      } else {
        const holdId = setTimeout(() => {
          if (cancelled) return;
          Animated.timing(logoOpacity, {
            toValue: 0,
            duration: LOGO_FADE_MS,
            useNativeDriver: true,
          }).start(({ finished }) => {
            if (cancelled || !finished) return;
            void targetPromise.then(() => {
              if (!cancelled) goToNextScreen(targetRef);
            });
          });
        }, LOGO_HOLD_MS);
        clearHold = () => clearTimeout(holdId);
      }

      return () => {
        cancelled = true;
        logoOpacity.stopAnimation();
        clearHold();
      };
    }, [goToNextScreen, logoOpacity, reduceMotion])
  );

  return (
    <View style={styles.root}>
      <LinearGradient colors={[...gradientColors]} style={StyleSheet.absoluteFillObject} />
      <View style={styles.center}>
        <Animated.View style={[styles.logoWrap, { opacity: logoOpacity }]} accessibilityRole="image" accessibilityLabel="Listio">
          <Image source={require('../../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
        </Animated.View>
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
