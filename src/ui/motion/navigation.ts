import { Platform } from 'react-native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { Easing, type WithTimingConfig } from 'react-native-reanimated';
import type { ColorScheme } from '../../design/theme';
import { easing } from './tokens';
import { motionMs } from './presets';

/**
 * Navigation transition targets (ms). Native Stack on iOS uses UIKit transitions;
 * these values document intent and back custom Reanimated screens or theme tuning.
 */
export const navigationDuration = {
  pushEnter: 300,
  pushExit: 260,
  popEnter: 260,
  popExit: 300,
  tabCrossfade: 200,
  fadeThrough: 220,
} as const;

/** Subtle horizontal feel when building custom transitions (translateX + opacity) */
export const navigationTravel = {
  pushOffset: 18,
  pushOffsetReduced: 4,
} as const;

/** Push / pop pair — restrained cubic, no bounce */
export function iosPushTiming(reduceMotion: boolean): WithTimingConfig {
  return {
    duration: motionMs(navigationDuration.pushEnter, reduceMotion),
    easing: easing.easeOut,
  };
}

export function iosPopTiming(reduceMotion: boolean): WithTimingConfig {
  return {
    duration: motionMs(navigationDuration.popExit, reduceMotion),
    easing: easing.easeIn,
  };
}

/** Tab / root content swap — light crossfade */
export function tabContentSwap(reduceMotion: boolean): WithTimingConfig {
  return {
    duration: motionMs(navigationDuration.tabCrossfade, reduceMotion),
    easing: Easing.out(Easing.quad),
  };
}

export function fadeThrough(reduceMotion: boolean): WithTimingConfig {
  return {
    duration: motionMs(navigationDuration.fadeThrough, reduceMotion),
    easing: easing.easeInOut,
  };
}

/** Reduce Motion: prefer opacity/state over travel */
export function noneReducedMotion(reduceMotion: boolean): WithTimingConfig {
  return {
    duration: motionMs(120, reduceMotion),
    easing: easing.easeInOut,
  };
}

/**
 * Default Native Stack options: iOS uses native push/pop; we only set surfaces and
 * avoid custom JS interpolators. Keep `animation: 'default'` for explicit intent.
 */
export function createNativeStackScreenOptions(theme: {
  background: string;
}): NativeStackNavigationOptions {
  return {
    animation: 'default',
    contentStyle: { backgroundColor: theme.background },
    headerStyle: { backgroundColor: theme.background },
    headerShadowVisible: false,
    fullScreenGestureEnabled: true,
  };
}

/**
 * Tab stacks with custom frosted headers and/or native blur bars: content scrolls under
 * chrome; iOS uses system material blur on default navigation headers.
 */
export function createTranslucentStackScreenOptions(theme: {
  background: string;
  colorScheme: ColorScheme;
}): NativeStackNavigationOptions {
  const isDark = theme.colorScheme === 'dark';
  return {
    ...createNativeStackScreenOptions(theme),
    headerTransparent: true,
    headerStyle: {
      backgroundColor: 'transparent',
    },
    headerShadowVisible: false,
    ...(Platform.OS === 'ios'
      ? {
          headerBlurEffect: isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight',
        }
      : {}),
  };
}
