import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
  peekSessionThemePreference,
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
const ThemeReadyContext = createContext(false);

function readOsColorScheme(): ColorScheme {
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

function resolveColorScheme(pref: ThemePreference): ColorScheme {
  return pref === 'system' ? readOsColorScheme() : pref;
}

/** Sync React Native Appearance with the saved preference. */
function applyThemePreferenceToOs(pref: ThemePreference): ColorScheme {
  if (pref === 'system') {
    Appearance.setColorScheme(null);
    return readOsColorScheme();
  }
  Appearance.setColorScheme(pref);
  return pref;
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
  const cachedPref = peekSessionThemePreference();
  const [preferenceReady, setPreferenceReady] = useState(cachedPref != null);
  const [selectedTheme, setSelectedThemeState] = useState<ThemePreference>(
    () => cachedPref ?? 'system'
  );
  const [osColorScheme, setOsColorScheme] = useState<ColorScheme>(() =>
    cachedPref ? resolveColorScheme(cachedPref) : readOsColorScheme()
  );
  const colorScheme: ColorScheme =
    selectedTheme === 'system' ? osColorScheme : selectedTheme;
  const { width } = useWindowDimensions();
  const theme = useMemo(
    () => buildTheme(colorScheme, width),
    [colorScheme, width],
  );

  const applyHydratedPreference = useCallback((pref: ThemePreference) => {
    const scheme = applyThemePreferenceToOs(pref);
    setSelectedThemeState(pref);
    setOsColorScheme(scheme);
    setPreferenceReady(true);
  }, []);

  const setSelectedTheme = useCallback((next: ThemePreference) => {
    const scheme = applyThemePreferenceToOs(next);
    setSelectedThemeState(next);
    setOsColorScheme(scheme);
    void persistThemePreference(next);
  }, []);

  const prefValue = useMemo(
    () => ({ selectedTheme, setSelectedTheme }),
    [selectedTheme, setSelectedTheme],
  );

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const load = () => {
      void hydrateThemePreference()
        .then((pref) => {
          if (cancelled) return;
          clearTimeout(themeTimeoutId);
          applyHydratedPreference(pref);
        })
        .catch((e) => {
          logger.warn('ThemeProvider: could not load appearance preference', e);
          if (cancelled) return;
          clearTimeout(themeTimeoutId);
          applyHydratedPreference('system');
        });
    };

    load();

    const themeHangMs = 10_000;
    const themeTimeoutId = setTimeout(() => {
      if (cancelled) return;
      logger.warnRelease(
        `Theme preference hydrate timed out after ${themeHangMs}ms; defaulting to system`
      );
      applyHydratedPreference('system');
    }, themeHangMs);

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { isSyncEnabled, supabase } = require('../services/supabaseClient') as typeof import(
        '../services/supabaseClient'
      );
      if (isSyncEnabled()) {
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
          if (cancelled) return;
          if (!session?.user) {
            void hydrateThemePreference().then((pref) => {
              if (!cancelled) applyHydratedPreference(pref);
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
      clearTimeout(themeTimeoutId);
      unsubscribe?.();
    };
  }, [applyHydratedPreference]);

  useEffect(() => {
    const appearanceSub = Appearance.addChangeListener(({ colorScheme: next }) => {
      if (selectedTheme !== 'system') return;
      setOsColorScheme(next === 'dark' ? 'dark' : 'light');
    });
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && selectedTheme === 'system') {
        setOsColorScheme(readOsColorScheme());
      }
    });
    return () => {
      appearanceSub.remove();
      appStateSub.remove();
    };
  }, [selectedTheme]);

  return (
    <ThemeReadyContext.Provider value={preferenceReady}>
      <ThemePreferenceContext.Provider value={prefValue}>
        <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
      </ThemePreferenceContext.Provider>
    </ThemeReadyContext.Provider>
  );
}

/** True after the saved theme preference (default: system) has been applied. */
export function useThemePreferenceReady(): boolean {
  return useContext(ThemeReadyContext);
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
