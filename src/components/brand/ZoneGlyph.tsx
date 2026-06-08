import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import type { ZoneKey } from '../../types/models';

/**
 * Custom aisle glyph set (item 7, Phase B) — one icon per ZoneKey, drawn in the
 * mascot's friendly rounded line style (24×24 grid, round caps/joins). These
 * replace the generic Ionicons in section headers, filter chips, and reorder
 * cards. Color is driven by the per-aisle palette (item 6); user emoji overrides
 * still take precedence upstream.
 */

type GlyphArgs = { c: string; sw: number };

const stroke = (c: string, sw: number) => ({
  stroke: c,
  strokeWidth: sw,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none',
});

const GLYPHS: Record<ZoneKey, (a: GlyphArgs) => React.ReactNode> = {
  // Leaf with a center vein
  produce: ({ c, sw }) => (
    <>
      <Path d="M5 19C5 11 11 5 19 5C19 13 13 19 5 19Z" {...stroke(c, sw)} />
      <Path d="M8.5 15.5C11 13 13.5 10.5 16 8.5" {...stroke(c, sw)} />
    </>
  ),
  // Bread loaf with two score marks
  bakery_deli: ({ c, sw }) => (
    <>
      <Path
        d="M4.5 13.5C4.5 9.5 7.5 7.5 12 7.5C16.5 7.5 19.5 9.5 19.5 13.5L19.5 15.5C19.5 16.3 18.8 17 18 17L6 17C5.2 17 4.5 16.3 4.5 15.5Z"
        {...stroke(c, sw)}
      />
      <Path d="M9.5 10.5L11 12.5" {...stroke(c, sw)} />
      <Path d="M13 10.5L14.5 12.5" {...stroke(c, sw)} />
    </>
  ),
  // Fish with tail and eye
  meat_seafood: ({ c, sw }) => (
    <>
      <Path
        d="M14 12C14 9.2 11.2 7.5 8 7.5C5 7.5 3.5 9.8 3.5 12C3.5 14.2 5 16.5 8 16.5C11.2 16.5 14 14.8 14 12Z"
        {...stroke(c, sw)}
      />
      <Path d="M14 12L19.5 8.5L19.5 15.5Z" {...stroke(c, sw)} />
      <Circle cx="7" cy="11" r="0.9" fill={c} />
    </>
  ),
  // Milk carton (gable top)
  dairy_eggs: ({ c, sw }) => (
    <>
      <Path
        d="M7.5 10L7.5 19C7.5 19.6 8 20 8.5 20L15.5 20C16 20 16.5 19.6 16.5 19L16.5 10L14 6L10 6Z"
        {...stroke(c, sw)}
      />
      <Path d="M7.5 10L16.5 10" {...stroke(c, sw)} />
      <Path d="M12 6L12 10" {...stroke(c, sw)} />
    </>
  ),
  // Snowflake
  frozen: ({ c, sw }) => (
    <>
      <Path d="M12 4L12 20" {...stroke(c, sw)} />
      <Path d="M5.1 8L18.9 16" {...stroke(c, sw)} />
      <Path d="M18.9 8L5.1 16" {...stroke(c, sw)} />
      <Path d="M9.5 5.2L12 7L14.5 5.2" {...stroke(c, sw)} />
      <Path d="M9.5 18.8L12 17L14.5 18.8" {...stroke(c, sw)} />
    </>
  ),
  // Can / jar with lid line
  pantry: ({ c, sw }) => (
    <>
      <Path
        d="M7 8.5C7 7.7 9.2 7 12 7C14.8 7 17 7.7 17 8.5L17 18.5C17 19.3 14.8 20 12 20C9.2 20 7 19.3 7 18.5Z"
        {...stroke(c, sw)}
      />
      <Path d="M7 11C8.5 11.6 10.2 11.8 12 11.8C13.8 11.8 15.5 11.6 17 11" {...stroke(c, sw)} />
    </>
  ),
  // Drink cup with straw
  snacks_drinks: ({ c, sw }) => (
    <>
      <Path
        d="M7 9L17 9L15.6 19C15.5 19.6 15 20 14.4 20L9.6 20C9 20 8.5 19.6 8.4 19Z"
        {...stroke(c, sw)}
      />
      <Path d="M6.5 9L17.5 9" {...stroke(c, sw)} />
      <Path d="M13.5 9L15.5 4.5" {...stroke(c, sw)} />
    </>
  ),
  // Spray bottle
  household_cleaning: ({ c, sw }) => (
    <>
      <Path
        d="M9 11L15 11L15 19.5C15 20.3 14.3 21 13.5 21L10.5 21C9.7 21 9 20.3 9 19.5Z"
        {...stroke(c, sw)}
      />
      <Path d="M9 11L9 7.5L12 7.5" {...stroke(c, sw)} />
      <Path d="M12 7.5L15 5.5" {...stroke(c, sw)} />
      <Circle cx="18" cy="5" r="0.8" fill={c} />
      <Circle cx="19" cy="8" r="0.8" fill={c} />
      <Circle cx="16.5" cy="8.5" r="0.8" fill={c} />
    </>
  ),
  // Lotion / care droplet
  personal_care: ({ c, sw }) => (
    <Path
      d="M12 4C12 4 6 11 6 15C6 18.3 8.7 21 12 21C15.3 21 18 18.3 18 15C18 11 12 4 12 4Z"
      {...stroke(c, sw)}
    />
  ),
  // Other — three dots
  other: ({ c }) => (
    <>
      <Circle cx="6" cy="12" r="1.5" fill={c} />
      <Circle cx="12" cy="12" r="1.5" fill={c} />
      <Circle cx="18" cy="12" r="1.5" fill={c} />
    </>
  ),
};

type ZoneGlyphProps = {
  zone: ZoneKey;
  /** Rendered square size in points. */
  size?: number;
  color: string;
  /** Stroke weight in the 24-unit grid. */
  strokeWidth?: number;
};

export function ZoneGlyph({ zone, size = 18, color, strokeWidth = 1.8 }: ZoneGlyphProps) {
  const render = GLYPHS[zone] ?? GLYPHS.other;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {render({ c: color, sw: strokeWidth })}
    </Svg>
  );
}
