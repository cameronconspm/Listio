import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { Appearance, AppState, Dimensions, useWindowDimensions } from 'react-native';
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
import {
  hydrateThemePreference,
  persistThemePreference,
  type ThemePreference,
} from '../services/themePreferenceService';

export type { ThemePreference } from '../services/themePreferenceService';

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

function readOsColorScheme(): ColorScheme {
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
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
  const [selectedTheme, setSelectedThemeState] = useState<ThemePreference>('system');
  const [osColorScheme, setOsColorScheme] = useState<ColorScheme>(readOsColorScheme);
  const colorScheme: ColorScheme =
    selectedTheme === 'system' ? osColorScheme : selectedTheme;
  const { width } = useWindowDimensions();
  const theme = useMemo(
    () => buildTheme(colorScheme, width),
    [colorScheme, width],
  );

  const setSelectedTheme = useCallback((next: ThemePreference) => {
    setSelectedThemeState(next);
    void persistThemePreference(next);
  }, []);

  const prefValue = useMemo(
    () => ({ selectedTheme, setSelectedTheme }),
    [selectedTheme, setSelectedTheme],
  );

  const syncOsAppearance = useCallback(() => {
    if (selectedTheme === 'system') {
      Appearance.setColorScheme(null);
    }
    setOsColorScheme(readOsColorScheme());
  }, [selectedTheme]);

  /** After the UIWindow exists — avoid touching Appearance before native window is ready. */
  useLayoutEffect(() => {
    syncOsAppearance();
  }, [syncOsAppearance]);

  useEffect(() => {
    const appearanceSub = Appearance.addChangeListener(({ colorScheme: next }) => {
      setOsColorScheme(next === 'dark' ? 'dark' : 'light');
    });
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && selectedTheme === 'system') {
        syncOsAppearance();
      }
    });
    return () => {
      appearanceSub.remove();
      appStateSub.remove();
    };
  }, [selectedTheme, syncOsAppearance]);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const load = () => {
      void hydrateThemePreference()
        .then((pref) => {
          if (!cancelled) setSelectedThemeState(pref);
        })
        .catch((e) => {
          logger.warn('ThemeProvider: could not load appearance preference', e);
        });
    };

    load();

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { isSyncEnabled, supabase } = require('../services/supabaseClient') as typeof import(
        '../services/supabaseClient'
      );
      if (isSyncEnabled()) {
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
          if (!session?.user) {
            void hydrateThemePreference().then((pref) => {
              if (!cancelled) setSelectedThemeState(pref);
            });
            return;
          }
          load();
        });
        unsubscribe = () => subscription.unsubscribe();
      }
    } catch (e) {
      logger.warn('ThemeProvider: could not subscribe to auth for appearance', e);
    }

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
