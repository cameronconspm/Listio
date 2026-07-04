import { useEffect, useState } from 'react';
import { Dimensions, PixelRatio } from 'react-native';

/** iOS Dynamic Type "Large" and above — switch onboarding preview layouts. */
export const ACCESSIBILITY_FONT_SCALE_LARGE = 1.15;

/** Accessibility sizes (AX1+) — tighten headlines and simplify chrome. */
export const ACCESSIBILITY_FONT_SCALE_EXTRA_LARGE = 1.3;

/** System accessibility font scale (iOS Dynamic Type / Android font size). */
export function readAccessibilityFontScale(): number {
  return PixelRatio.getFontScale();
}

export function isLargeAccessibilityText(
  scale: number = readAccessibilityFontScale(),
): boolean {
  return scale >= ACCESSIBILITY_FONT_SCALE_LARGE;
}

export function isExtraLargeAccessibilityText(
  scale: number = readAccessibilityFontScale(),
): boolean {
  return scale >= ACCESSIBILITY_FONT_SCALE_EXTRA_LARGE;
}

/** Live system font scale; updates when the user changes text size in Settings. */
export function useAccessibilityFontScale(): number {
  const [fontScale, setFontScale] = useState(readAccessibilityFontScale);

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', () => {
      setFontScale(readAccessibilityFontScale());
    });
    return () => sub.remove();
  }, []);

  return fontScale;
}
