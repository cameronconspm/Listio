import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { toDateString } from '../utils/dateUtils';
import type { MealScheduleConfig } from '../types/preferences';
import { fetchUserPreferences, patchUserPreferencesIfSync } from '../services/userPreferencesService';
import { getUserId, isSyncEnabled } from '../services/supabaseClient';

const STORAGE_KEY = '@listio/meal_schedule_config';

export type { MealScheduleConfig } from '../types/preferences';

const VALID_LENGTHS: MealScheduleConfig['length'][] = [1, 2, 3, 4, 5, 6, 7];

function getDefaultConfig(): MealScheduleConfig {
  const today = new Date();
  return {
    startDate: toDateString(today),
    length: 7,
  };
}

function isValidConfig(c: unknown): c is MealScheduleConfig {
  if (!c || typeof c !== 'object') return false;
  const o = c as Record<string, unknown>;
  if (typeof o.startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.startDate)) return false;
  if (typeof o.length !== 'number' || !VALID_LENGTHS.includes(o.length as MealScheduleConfig['length'])) return false;
  return true;
}

export function useMealScheduleConfig() {
  const [config, setConfigState] = useState<MealScheduleConfig>(() => getDefaultConfig());

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (isSyncEnabled()) {
        const uid = await getUserId();
        if (uid && mounted) {
          try {
            const p = await fetchUserPreferences();
            if (p.mealScheduleConfig && isValidConfig(p.mealScheduleConfig)) {
              setConfigState(p.mealScheduleConfig);
              await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(p.mealScheduleConfig));
              return;
            }
          } catch {
            // fall through
          }
        }
      }
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw && mounted) {
        try {
          const parsed = JSON.parse(raw) as unknown;
          if (isValidConfig(parsed)) {
            setConfigState(parsed);
            return;
          }
        } catch {
          // fall through
        }
      }
      if (mounted) setConfigState(getDefaultConfig());
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const setConfig = useCallback((next: MealScheduleConfig) => {
    setConfigState(next);
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    void patchUserPreferencesIfSync({ mealScheduleConfig: next });
  }, []);

  return { config, setConfig };
}
