import { PixelRatio } from 'react-native';
import type { TextStyle, ViewStyle } from 'react-native';
import { typography as baseTypography } from './typography';
import { spacing as baseSpacing } from './spacing';
import { radius as baseRadius } from './radius';
import { shadows as baseShadows } from './shadows';

/**
 * Logical width (pt) of the design baseline — tuned on iPhone 16 Pro Max class devices.
 * Adjust only if the reference device changes.
 */
export const DESIGN_REFERENCE_WIDTH_PT = 440;

/** Prevents over-shrinking on small phones or over-growing on large ones. */
export const LAYOUT_SCALE_MIN = 0.92;
export const LAYOUT_SCALE_MAX = 1.06;

/**
 * Typography tracks device width slightly less than layout (softer step between Mini and Pro Max).
 * 1 = same as layout scale; lower = less font swing.
 */
export const FONT_SCALE_SOFTEN = 0.88;

export type LayoutMetrics = {
  /** Raw width / reference before clamp. */
  layoutScaleRaw: number;
  /** Clamped scale for spacing, radii, shadows. */
  layoutScale: number;
  /** Softer scale for fontSize / lineHeight. */
  fontScale: number;
};

export function computeLayoutMetrics(windowWidth: number): LayoutMetrics {
  const layoutScaleRaw = windowWidth / DESIGN_REFERENCE_WIDTH_PT;
  const layoutScale = Math.min(
    LAYOUT_SCALE_MAX,
    Math.max(LAYOUT_SCALE_MIN, layoutScaleRaw),
  );
  const fontScale = 1 + (layoutScale - 1) * FONT_SCALE_SOFTEN;
  return { layoutScaleRaw, layoutScale, fontScale };
}

export function roundPx(n: number): number {
  return PixelRatio.roundToNearestPixel(n);
}

function scaleTextStyle(style: TextStyle, fontScale: number): TextStyle {
  const next: TextStyle = { ...style };
  if (typeof next.fontSize === 'number') {
    next.fontSize = roundPx(next.fontSize * fontScale);
  }
  if (typeof next.lineHeight === 'number') {
    next.lineHeight = roundPx(next.lineHeight * fontScale);
  }
  return next;
}

export function scaleTypography(
  fontScale: number,
): Record<string, TextStyle> {
  const out: Record<string, TextStyle> = {};
  for (const key of Object.keys(baseTypography)) {
    out[key] = scaleTextStyle(baseTypography[key]!, fontScale);
  }
  return out;
}

export function scaleSpacing(layoutScale: number): typeof baseSpacing {
  const s = layoutScale;
  return {
    xxs: roundPx(baseSpacing.xxs * s),
    xs: roundPx(baseSpacing.xs * s),
    sm: roundPx(baseSpacing.sm * s),
    md: roundPx(baseSpacing.md * s),
    lg: roundPx(baseSpacing.lg * s),
    xl: roundPx(baseSpacing.xl * s),
    xxl: roundPx(baseSpacing.xxl * s),
  } as typeof baseSpacing;
}

export function scaleRadius(layoutScale: number): typeof baseRadius {
  const s = layoutScale;
  return {
    xs: roundPx(baseRadius.xs * s),
    sm: roundPx(baseRadius.sm * s),
    md: roundPx(baseRadius.md * s),
    input: roundPx(baseRadius.input * s),
    lg: roundPx(baseRadius.lg * s),
    card: roundPx(baseRadius.card * s),
    xl: roundPx(baseRadius.xl * s),
    sheet: roundPx(baseRadius.sheet * s),
    glass: roundPx(baseRadius.glass * s),
    full: baseRadius.full,
  } as typeof baseRadius;
}

function scaleShadowStyle(style: ViewStyle, layoutScale: number): ViewStyle {
  const s = layoutScale;
  const next: ViewStyle = { ...style };
  if (next.shadowOffset && typeof next.shadowOffset === 'object') {
    const o = next.shadowOffset;
    next.shadowOffset = {
      width: roundPx((o.width ?? 0) * s),
      height: roundPx((o.height ?? 0) * s),
    };
  }
  if (typeof next.shadowRadius === 'number') {
    next.shadowRadius = roundPx(next.shadowRadius * s);
  }
  if (typeof next.elevation === 'number') {
    next.elevation = Math.max(0, Math.round(next.elevation * s));
  }
  return next;
}

export function scaleShadows(layoutScale: number): typeof baseShadows {
  const keys = Object.keys(baseShadows) as (keyof typeof baseShadows)[];
  const out: Partial<Record<keyof typeof baseShadows, ViewStyle>> = {};
  for (const k of keys) {
    out[k] = scaleShadowStyle(baseShadows[k] as ViewStyle, layoutScale);
  }
  return out as typeof baseShadows;
}

/** Default metrics when no window is available (tests): reference width → unit scale. */
export const defaultLayoutMetrics: LayoutMetrics = {
  layoutScaleRaw: 1,
  layoutScale: 1,
  fontScale: 1,
};
