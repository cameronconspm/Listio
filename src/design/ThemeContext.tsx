import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Dimensions, useColorScheme, useWindowDimensions } from 'react-native';
import { getTheme, type ColorScheme } from './theme';
import {
  computeLayoutMetrics,
  scaleTypography,
  scaleSpacing,
  scaleRadius,
  scaleShadows,
  type LayoutMetrics,
} from './layoutMetrics';
import type { SemanticTokenKey } from './tokens';
import { logger } from '../utils/logger';

export type ThemePreference = 'system' | 'light' | 'dark';

export type AppTheme = ReturnType<typeof getTheme> &
  LayoutMetrics & {
    spacing: ReturnType<typeof scaleSpacing>;
    radius: ReturnType<typeof scaleRadius>;
    typography: ReturnType<typeof scaleTypography>;
    shadows: ReturnType<typeof scaleShadows>;
    colorScheme: ColorScheme;
  };

type Theme = AppTheme;

const ThemeContext = createContext<Theme | null>(null);
const ThemePreferenceContext = createContext<{
  selectedTheme: ThemePreference;
  setSelectedTheme: (theme: ThemePreference) => void;
} | null>(null);

function normalizeThemePreference(raw: unknown): ThemePreference {
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
}

function buildTheme(scheme: ColorScheme, windowWidth: number): Theme {
  const colors = getTheme(scheme);
  const metrics = computeLayoutMetrics(windowWidth);
  return {
    ...colors,
    ...metrics,
    spacing: scaleSpacing(metrics.layoutScale),
    radius: scaleRadius(metrics.layoutScale),
    typography: scaleTypography(metrics.fontScale),
    shadows: scaleShadows(metrics.layoutScale),
    colorScheme: scheme,
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme() ?? 'light';
  const [selectedTheme, setSelectedTheme] = useState<ThemePreference>('system');
  const colorScheme = selectedTheme === 'system' ? systemColorScheme : selectedTheme;
  const { width } = useWindowDimensions();
  const theme = useMemo(
    () => buildTheme(colorScheme, width),
    [colorScheme, width],
  );
  const prefValue = useMemo(
    () => ({ selectedTheme, setSelectedTheme }),
    [selectedTheme],
  );

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const bootstrap = async () => {
      try {
        // Lazy require avoids initializing Supabase in tests / screens that only need theme tokens.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { fetchUserPreferences } = require('../services/userPreferencesService') as typeof import(
          '../services/userPreferencesService'
        );
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { isSyncEnabled, supabase } = require('../services/supabaseClient') as typeof import(
          '../services/supabaseClient'
        );

        if (cancelled) return;
        if (!isSyncEnabled()) {
          setSelectedTheme('system');
          return;
        }

        const load = async () => {
          const prefs = await fetchUserPreferences();
          if (!cancelled) {
            setSelectedTheme(normalizeThemePreference(prefs.appearance?.selectedTheme));
          }
        };

        void load().catch((e) => {
          logger.warn('ThemeProvider: could not load appearance preference', e);
        });

        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
          if (!session?.user) {
            setSelectedTheme('system');
            return;
          }
          void load().catch((e) => {
            logger.warn('ThemeProvider: could not load appearance preference', e);
          });
        });
        unsubscribe = () => subscription.unsubscribe();
      } catch (e) {
        if (cancelled) return;
        logger.warn('ThemeProvider: could not initialize appearance preference', e);
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return (
    <ThemePreferenceContext.Provider value={prefValue}>
      <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
    </ThemePreferenceContext.Provider>
  );
}

/** Module-level fallback theme used only when `useTheme` is called outside a
 *  provider. Built once so the fallback path returns a stable reference and
 *  memoized consumers do not re-render on every parent render. */
let FALLBACK_THEME: Theme | null = null;
function getFallbackTheme(): Theme {
  if (!FALLBACK_THEME) {
    const w = Dimensions.get('window').width;
    FALLBACK_THEME = buildTheme('light', w);
  }
  return FALLBACK_THEME;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    if (__DEV__) {
      console.warn('useTheme() called outside ThemeProvider; falling back to light theme.');
    }
    return getFallbackTheme();
  }
  return ctx;
}

export function useThemeColor(key: SemanticTokenKey): string {
  return useTheme()[key];
}

export function useThemePreference() {
  const ctx = useContext(ThemePreferenceContext);
  if (!ctx) {
    return {
      selectedTheme: 'system' as ThemePreference,
      setSelectedTheme: () => {},
    };
  }
  return ctx;
}
