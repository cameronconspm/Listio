import React from 'react';
import Animated from 'react-native-reanimated';
import { useReduceMotion } from '../../ui/motion/useReduceMotion';
import { onboardingStepEnter } from './onboardingMotion';

type Props = {
  children: React.ReactNode;
  /** Changes when step changes so entering animation re-runs. */
  stepKey: number;
};

/** Step-level enter — spring fade-up. Respects reduced motion. */
export function OnboardingAnimatedStep({ children, stepKey }: Props) {
  const reduced = useReduceMotion();
  return (
    <Animated.View key={stepKey} entering={onboardingStepEnter(reduced)}>
      {children}
    </Animated.View>
  );
}
