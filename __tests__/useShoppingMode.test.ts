import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import {
  resetShoppingModeSessionForTests,
  useShoppingMode,
} from '../src/hooks/useShoppingMode';

type HookCapture = {
  mode: ReturnType<typeof useShoppingMode>[0];
  setMode: ReturnType<typeof useShoppingMode>[1];
};

function HookProbe({ capture }: { capture: HookCapture }) {
  const [mode, setMode] = useShoppingMode();
  capture.mode = mode;
  capture.setMode = setMode;
  return null;
}

function mountProbe(): HookCapture {
  const capture = {} as HookCapture;
  act(() => {
    TestRenderer.create(React.createElement(HookProbe, { capture }));
  });
  return capture;
}

describe('useShoppingMode', () => {
  beforeEach(() => {
    resetShoppingModeSessionForTests();
  });

  it('defaults to plan on a fresh session', () => {
    const capture = mountProbe();
    expect(capture.mode).toBe('plan');
  });

  it('keeps the last mode in session memory across hook remounts', () => {
    const first = mountProbe();
    act(() => {
      first.setMode('shop');
    });

    const second = mountProbe();
    expect(second.mode).toBe('shop');
  });

  it('resets to plan when the session is cleared (cold launch)', () => {
    const first = mountProbe();
    act(() => {
      first.setMode('shop');
    });

    resetShoppingModeSessionForTests();

    const afterColdLaunch = mountProbe();
    expect(afterColdLaunch.mode).toBe('plan');
  });
});
