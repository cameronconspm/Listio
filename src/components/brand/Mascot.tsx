import React from 'react';
import { Image, View, type ViewStyle, type StyleProp } from 'react-native';

/**
 * Listio's grocery-bag mascot (item 7). One character, three expressions, used at
 * hero moments — empty states (empty), the shop-run-complete payoff (celebrate),
 * and onboarding/general surfaces (hero).
 *
 * The art ships with a transparent background (a soft contact shadow is baked in),
 * so the character floats directly on whatever surface it sits on.
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
};

export function Mascot({
  mood = 'hero',
  size = 140,
  style,
  accessibilityLabel,
}: MascotProps) {
  return (
    <View
      style={[
        { width: size, height: size, alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
    >
      <Image
        source={MASCOT_SOURCES[mood]}
        resizeMode="contain"
        style={{ width: size, height: size }}
      />
    </View>
  );
}
