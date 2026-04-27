import React from 'react';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';

type Props = {
  children: React.ReactNode;
  /** Changes when step changes so entering animation re-runs. */
  stepKey: number;
};

/**
 * Subtle fade + upward motion for step content. Respects reduced motion.
 */
export function OnboardingAnimatedStep({ children, stepKey }: Props) {
  const reduced = useReducedMotion();
  const entering = reduced ? undefined : FadeInUp.duration(380).delay(48);

  return (
    <Animated.View key={stepKey} entering={entering}>
      {children}
    </Animated.View>
  );
}
