import { FadeIn, FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';

export function onboardingStepEnter(reduced: boolean) {
  if (reduced) return undefined;
  return FadeInUp.duration(440).springify().damping(20).stiffness(260);
}

export function onboardingItemEnter(reduced: boolean, delayMs: number) {
  if (reduced) return undefined;
  return FadeInDown.duration(380)
    .delay(delayMs)
    .springify()
    .damping(19)
    .stiffness(280);
}

export function onboardingPanelEnter(reduced: boolean) {
  if (reduced) return undefined;
  return FadeIn.duration(280);
}

export function onboardingCelebrateEnter(reduced: boolean) {
  if (reduced) return undefined;
  return ZoomIn.springify().damping(17).stiffness(200).mass(0.85);
}
