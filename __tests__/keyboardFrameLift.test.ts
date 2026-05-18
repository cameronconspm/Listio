import { getKeyboardFrameLiftTarget } from '../src/hooks/useKeyboardFrameLift';

describe('getKeyboardFrameLiftTarget', () => {
  it('subtracts the resting bottom offset and adds the requested gap', () => {
    expect(getKeyboardFrameLiftTarget(345, 68, 8)).toBe(285);
  });

  it('does not lift when the keyboard is below the resting surface', () => {
    expect(getKeyboardFrameLiftTarget(48, 68, 8)).toBe(0);
  });
});
