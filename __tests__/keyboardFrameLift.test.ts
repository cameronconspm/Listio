import {
  COMPOSER_KEYBOARD_EDGE_GAP,
  getStickyQuickBarBottomInset,
} from '../src/hooks/useKeyboardFrameLift';

describe('COMPOSER_KEYBOARD_EDGE_GAP', () => {
  it('is 6pt for tab bar and keyboard spacing', () => {
    expect(COMPOSER_KEYBOARD_EDGE_GAP).toBe(6);
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

  it('applies extra lift when provided', () => {
    expect(getStickyQuickBarBottomInset(345, tabBar, gap, 12)).toBe(345 + gap + 12);
    expect(getStickyQuickBarBottomInset(0, tabBar, gap, 12)).toBe(tabBar + gap + 12);
  });
});
