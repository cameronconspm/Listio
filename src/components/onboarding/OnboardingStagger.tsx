import React, { type ReactNode } from 'react';
import Animated from 'react-native-reanimated';
import { useReduceMotion } from '../../ui/motion/useReduceMotion';
import { onboardingItemEnter } from './onboardingMotion';

const STAGGER_MS = 72;

type Props = {
  children: ReactNode;
  /** Stagger index — 0 = first item. */
  index: number;
};

/** Staggered enter for cards and rows within a step. */
export function OnboardingStagger({ children, index }: Props) {
  const reduced = useReduceMotion();
  return (
    <Animated.View entering={onboardingItemEnter(reduced, index * STAGGER_MS)}>{children}</Animated.View>
  );
}
