import { PixelRatio } from 'react-native';
import { computeScrollBottomInset } from '../src/design/layoutMetrics';
import {
  ACCESSIBILITY_FONT_SCALE_EXTRA_LARGE,
  ACCESSIBILITY_FONT_SCALE_LARGE,
  isExtraLargeAccessibilityText,
  isLargeAccessibilityText,
  readAccessibilityFontScale,
} from '../src/ui/accessibility/useAccessibilityFontScale';

describe('useAccessibilityFontScale helpers', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('readAccessibilityFontScale returns PixelRatio.getFontScale()', () => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1.353);
    expect(readAccessibilityFontScale()).toBe(1.353);
  });

  it('isLargeAccessibilityText respects threshold', () => {
    expect(isLargeAccessibilityText(ACCESSIBILITY_FONT_SCALE_LARGE)).toBe(true);
    expect(isLargeAccessibilityText(ACCESSIBILITY_FONT_SCALE_LARGE - 0.01)).toBe(false);
  });

  it('isExtraLargeAccessibilityText respects threshold', () => {
    expect(isExtraLargeAccessibilityText(ACCESSIBILITY_FONT_SCALE_EXTRA_LARGE)).toBe(true);
    expect(isExtraLargeAccessibilityText(ACCESSIBILITY_FONT_SCALE_EXTRA_LARGE - 0.01)).toBe(false);
  });
});

describe('computeScrollBottomInset', () => {
  it('sums footer height and extra padding', () => {
    expect(computeScrollBottomInset({ footerHeight: 120, extra: 8 })).toBe(128);
  });
});
