import {
  COMPOSER_KEYBOARD_EDGE_GAP,
  getStickyQuickBarBottomInset,
  resolveStickyQuickBarBottomInset,
} from '../src/hooks/useKeyboardFrameLift';

describe('COMPOSER_KEYBOARD_EDGE_GAP', () => {
  it('is 6pt for tab bar and keyboard spacing', () => {
    expect(COMPOSER_KEYBOARD_EDGE_GAP).toBe(6);
  });
});

describe('resolveStickyQuickBarBottomInset', () => {
  const tabBar = 64;
  const gap = COMPOSER_KEYBOARD_EDGE_GAP;

  it('rests edgeGap above the tab bar when the keyboard is closed', () => {
    expect(resolveStickyQuickBarBottomInset(0, tabBar, 0, gap)).toBe(tabBar + gap);
  });

  it('stays edgeGap above the keyboard when fully open', () => {
    expect(resolveStickyQuickBarBottomInset(345, tabBar, 1, gap)).toBe(345 + gap);
  });

  it('clamps to tab bar resting inset while dismissing (low progress, small kb height)', () => {
    expect(resolveStickyQuickBarBottomInset(12, tabBar, 0.2, gap)).toBe(tabBar + gap);
  });

  it('follows keyboard height mid-dismiss when still clearly open', () => {
    expect(resolveStickyQuickBarBottomInset(280, tabBar, 0.8, gap)).toBe(280 + gap);
  });

  it('recovers from stale non-zero keyboard height after close (progress at 0)', () => {
    expect(resolveStickyQuickBarBottomInset(3, tabBar, 0, gap)).toBe(tabBar + gap);
  });

  it('applies extra lift when provided', () => {
    expect(resolveStickyQuickBarBottomInset(345, tabBar, 1, gap, 12)).toBe(345 + gap + 12);
    expect(resolveStickyQuickBarBottomInset(0, tabBar, 0, gap, 12)).toBe(tabBar + gap + 12);
  });
});

describe('getStickyQuickBarBottomInset', () => {
  const tabBar = 64;
  const gap = COMPOSER_KEYBOARD_EDGE_GAP;

  it('rests edgeGap above the tab bar when the keyboard is closed', () => {
    expect(getStickyQuickBarBottomInset(0, tabBar, gap)).toBe(tabBar + gap);
  });

  it('stays edgeGap above the keyboard for any keyboard height', () => {
    expect(getStickyQuickBarBottomInset(50, tabBar, gap)).toBe(50 + gap);
    expect(getStickyQuickBarBottomInset(345, tabBar, gap)).toBe(345 + gap);
  });
});
