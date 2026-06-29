import { useState, useCallback } from 'react';
import type { ShoppingMode } from '../types/preferences';

export type { ShoppingMode } from '../types/preferences';

/** In-memory only — resets to Plan on cold launch; survives tab switches within one app session. */
let sessionShoppingMode: ShoppingMode = 'plan';

/** @internal Test helper — resets session shopping mode. */
export function resetShoppingModeSessionForTests(): void {
  sessionShoppingMode = 'plan';
}

export function useShoppingMode(): [ShoppingMode, (mode: ShoppingMode) => void] {
  const [mode, setModeState] = useState<ShoppingMode>(() => sessionShoppingMode);

  const setMode = useCallback((next: ShoppingMode) => {
    sessionShoppingMode = next;
    setModeState(next);
  }, []);

  return [mode, setMode];
}
