import React, { useEffect, useRef } from 'react';
import { Image, View, type ViewStyle, type StyleProp } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

/**
 * Listio's grocery-bag mascot (item 7). One character, three expressions, used at
 * hero moments — empty states (empty), the shop-run-complete payoff (celebrate),
 * and onboarding/general surfaces (hero).
 *
 * The art ships with a transparent background (a soft contact shadow is baked in),
 * so the character floats directly on whatever surface it sits on.
 *
 * Animations:
 *  - Idle float: gentle vertical bob every ~3s (disabled when reduceMotion is on)
 *  - Mood transition: spring-bounce scale whenever `mood` changes
 *  - Entrance: spring scale-in on first render (opt-out via `skipEntrance`)
 *  - Periodic wiggle: subtle left-right tilt every ~6s
 */
const MASCOT_SOURCES = {
  hero: require('../../../assets/mascot/mascot-hero.png'),
  celebrate: require('../../../assets/mascot/mascot-celebrate.png'),
  empty: require('../../../assets/mascot/mascot-empty.png'),
} as const;

export type MascotMood = keyof typeof MASCOT_SOURCES;

type MascotProps = {
  mood?: MascotMood;
  /** Rendered square size in points. */
  size?: number;
  style?: StyleProp<ViewStyle>;
  /** Optional accessibility label; defaults to decorative (hidden). */
  accessibilityLabel?: string;
  /**
   * When true the mascot idles: floats, periodically wiggles, and bounces on
   * mood changes. Defaults to true.
   */
  animate?: boolean;
  /** Skip the entrance scale-in (e.g. inside a list that already has entering). */
  skipEntrance?: boolean;
};

const FLOAT_AMPLITUDE = 5;  // px up/down
const FLOAT_PERIOD_MS = 2800;
const WIGGLE_AMPLITUDE = 4; // degrees
const WIGGLE_PERIOD_MS = 6000;

export function Mascot({
  mood = 'hero',
  size = 140,
  style,
  accessibilityLabel,
  animate = true,
  skipEntrance = false,
}: MascotProps) {
  const rm = useReducedMotion();
  const shouldAnimate = animate && !rm;

  const scale = useSharedValue(skipEntrance ? 1 : 0.7);
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);

  const prevMood = useRef<MascotMood>(mood);
  const mounted = useRef(false);

  // Entrance pop on first mount.
  useEffect(() => {
    if (skipEntrance) return;
    scale.value = withSpring(1, { damping: 14, stiffness: 220, mass: 0.8 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mood-change bounce whenever mood prop changes after mount.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      prevMood.current = mood;
      return;
    }
    if (mood === prevMood.current) return;
    prevMood.current = mood;
    if (!shouldAnimate) return;
    scale.value = withSequence(
      withTiming(0.88, { duration: 100, easing: Easing.out(Easing.cubic) }),
      withSpring(1.1, { damping: 10, stiffness: 300 }),
      withSpring(1, { damping: 12, stiffness: 260 }),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood]);

  // Idle float — continuous vertical bob.
  useEffect(() => {
    if (!shouldAnimate) {
      translateY.value = 0;
      return;
    }
    translateY.value = withRepeat(
      withSequence(
        withTiming(-FLOAT_AMPLITUDE, {
          duration: FLOAT_PERIOD_MS / 2,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(0, {
          duration: FLOAT_PERIOD_MS / 2,
          easing: Easing.inOut(Easing.sin),
        }),
      ),
      -1,
      false,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAnimate]);

  // Periodic wiggle — slight rotation sway every ~6s.
  useEffect(() => {
    if (!shouldAnimate) {
      rotate.value = 0;
      return;
    }
    rotate.value = withRepeat(
      withSequence(
        withDelay(
          WIGGLE_PERIOD_MS,
          withSequence(
            withTiming(WIGGLE_AMPLITUDE, { duration: 120, easing: Easing.out(Easing.cubic) }),
            withTiming(-WIGGLE_AMPLITUDE, { duration: 240, easing: Easing.inOut(Easing.cubic) }),
            withTiming(WIGGLE_AMPLITUDE / 2, { duration: 180, easing: Easing.inOut(Easing.cubic) }),
            withTiming(0, { duration: 140, easing: Easing.out(Easing.cubic) }),
          ),
        ),
      ),
      -1,
      false,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAnimate]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  return (
    <View
      style={[
        { width: size, height: size + FLOAT_AMPLITUDE, alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
    >
      <Animated.View style={animatedStyle}>
        <Image
          source={MASCOT_SOURCES[mood]}
          resizeMode="contain"
          style={{ width: size, height: size }}
        />
      </Animated.View>
    </View>
  );
}
