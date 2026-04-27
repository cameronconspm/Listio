import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ShoppingMode } from '../types/preferences';
import { fetchUserPreferences, patchUserPreferencesIfSync } from '../services/userPreferencesService';
import { getUserId, isSyncEnabled } from '../services/supabaseClient';

const STORAGE_KEY = '@listio/shopping_mode';

export type { ShoppingMode } from '../types/preferences';

export type ShoppingModeState = {
  /** True after the first preferences read completes — use to avoid rendering Plan/Shop in a wrong default state */
  isHydrated: boolean;
};

export function useShoppingMode(): [ShoppingMode, (mode: ShoppingMode) => void, ShoppingModeState] {
  const [mode, setModeState] = useState<ShoppingMode>('plan');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      let next: ShoppingMode = 'plan';
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === 'shop') next = 'shop';

        if (isSyncEnabled()) {
          const uid = await getUserId();
          if (uid) {
            try {
              const p = await fetchUserPreferences();
              if (p.shoppingMode === 'shop' || p.shoppingMode === 'plan') {
                next = p.shoppingMode;
                await AsyncStorage.setItem(STORAGE_KEY, next);
              }
            } catch {
              /* keep local `next` */
            }
          }
        }
      } catch {
        next = 'plan';
      }

      if (!mounted) return;
      setModeState(next);
      setIsHydrated(true);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const setMode = useCallback((next: ShoppingMode) => {
    setModeState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next);
    void patchUserPreferencesIfSync({ shoppingMode: next });
  }, []);

  return [mode, setMode, { isHydrated }];
}
