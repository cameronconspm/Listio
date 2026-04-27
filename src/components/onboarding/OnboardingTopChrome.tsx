import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { useTheme } from '../../design/ThemeContext';
import { createOnboardingLayout } from '../../screens/onboarding/onboardingTokens';

type Props = {
  stepIndex: number;
  totalSteps: number;
  topInset: number;
};

export function OnboardingTopChrome({ stepIndex, totalSteps, topInset }: Props) {
  const theme = useTheme();
  const onboardingLayout = useMemo(() => createOnboardingLayout(theme.spacing), [theme]);
  const reduced = useReducedMotion();
  const trackW = useSharedValue(0);
  const progress = useSharedValue((stepIndex + 1) / totalSteps);

  useEffect(() => {
    const next = (stepIndex + 1) / totalSteps;
    progress.value = withTiming(next, { duration: reduced ? 0 : 380 });
  }, [stepIndex, totalSteps, progress, reduced]);

  const onTrackLayout = (e: LayoutChangeEvent) => {
    trackW.value = e.nativeEvent.layout.width;
  };

  const fillStyle = useAnimatedStyle(() => ({
    width: trackW.value * progress.value,
  }));

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingHorizontal: onboardingLayout.horizontalPadding,
          paddingTop: topInset + theme.spacing.xs,
          paddingBottom: onboardingLayout.chromeBottomPadding,
        },
      ]}
    >
      <View
        style={[
          styles.track,
          {
            height: onboardingLayout.progressTrackHeight,
            backgroundColor: theme.colorScheme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(60,60,67,0.08)',
          },
        ]}
        onLayout={onTrackLayout}
      >
        <Animated.View
          style={[
            styles.fill,
            {
              height: onboardingLayout.progressTrackHeight,
              backgroundColor: theme.accent,
              opacity: 0.92,
            },
            fillStyle,
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  track: {
    width: '100%',
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: 2,
  },
});
