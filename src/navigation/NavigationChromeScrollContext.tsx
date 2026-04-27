import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useFocusEffect, useNavigation, useNavigationState } from '@react-navigation/native';
import type { SharedValue } from 'react-native-reanimated';
import {
  useSharedValue,
  useDerivedValue,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import type { TabChromeRootKey } from './navigationChromeScroll';
import { CHROME_SCROLL_FADE_RANGE, TAB_CHROME_ORDER } from './navigationChromeScroll';

type ScrollYMap = Record<TabChromeRootKey, SharedValue<number>>;

type NavigationChromeScrollContextValue = {
  scrollY: ScrollYMap;
  /** Settings / Profile stack scroll — drives native header chrome solid/frosted */
  settingsScrollY: SharedValue<number>;
};

const NavigationChromeScrollContext = createContext<NavigationChromeScrollContextValue | null>(
  null
);

/** When settings UI is shown as a tab (`ProfileStack`), scroll updates both modal chrome + tab bar. */
export const SettingsStackPresentationContext = createContext<'modal' | 'tab'>('modal');

/** Sync when nested stack (e.g. RecipeDetails) is pushed — force frosted chrome */
function useSyncStackPushedForTab(tabKey: TabChromeRootKey, stackPushed: SharedValue<number>) {
  const navigation = useNavigation();

  useEffect(() => {
    const sync = () => {
      const tabNav = navigation.getParent();
      const st = tabNav?.getState();
      const route = st?.routes.find((r) => r.name === tabKey);
      const nested = route?.state as { routes?: unknown[] } | undefined;
      const d = nested?.routes?.length ?? 1;
      stackPushed.value = d > 1 ? 1 : 0;
    };
    sync();
    const parent = navigation.getParent();
    const unsub = parent?.addListener('state', sync);
    return () => {
      unsub?.();
    };
  }, [navigation, tabKey, stackPushed]);
}

export function NavigationChromeScrollProvider({ children }: { children: React.ReactNode }) {
  const listY = useSharedValue(0);
  const mealsY = useSharedValue(0);
  const recipesY = useSharedValue(0);
  const profileY = useSharedValue(0);
  const settingsScrollY = useSharedValue(0);

  const scrollY = useMemo<ScrollYMap>(
    () => ({
      ListTab: listY,
      MealsStack: mealsY,
      RecipesStack: recipesY,
      ProfileStack: profileY,
    }),
    [listY, mealsY, recipesY, profileY]
  );

  const value = useMemo(
    () => ({ scrollY, settingsScrollY }),
    [scrollY, settingsScrollY]
  );

  return (
    <NavigationChromeScrollContext.Provider value={value}>
      {children}
    </NavigationChromeScrollContext.Provider>
  );
}

export function useNavigationChromeScroll(): NavigationChromeScrollContextValue {
  const ctx = useContext(NavigationChromeScrollContext);
  if (!ctx) {
    throw new Error('useNavigationChromeScroll must be used within NavigationChromeScrollProvider');
  }
  return ctx;
}

export function useOptionalNavigationChromeScroll(): NavigationChromeScrollContextValue | null {
  return useContext(NavigationChromeScrollContext);
}

export function useTabRootScrollOnScroll(tabKey: TabChromeRootKey) {
  const { scrollY } = useNavigationChromeScroll();
  const y = scrollY[tabKey];
  return useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      y.value = Math.max(0, e.nativeEvent.contentOffset.y);
    },
    [y]
  );
}

export function useSettingsRootScrollOnScroll() {
  const { settingsScrollY } = useNavigationChromeScroll();
  return useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      settingsScrollY.value = Math.max(0, e.nativeEvent.contentOffset.y);
    },
    [settingsScrollY]
  );
}

export function useResetSettingsScrollOnFocus() {
  const { settingsScrollY, scrollY } = useNavigationChromeScroll();
  const presentation = useContext(SettingsStackPresentationContext);
  const profileY = scrollY.ProfileStack;
  useFocusEffect(
    useCallback(() => {
      settingsScrollY.value = 0;
      if (presentation === 'tab') profileY.value = 0;
    }, [settingsScrollY, profileY, presentation])
  );
}

/** Scroll handler + reset chrome offset when a Settings screen gains focus */
export function useSettingsScrollHandler() {
  const { settingsScrollY, scrollY } = useNavigationChromeScroll();
  const presentation = useContext(SettingsStackPresentationContext);
  const profileY = scrollY.ProfileStack;
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = Math.max(0, e.nativeEvent.contentOffset.y);
      settingsScrollY.value = y;
      if (presentation === 'tab') profileY.value = y;
    },
    [settingsScrollY, profileY, presentation]
  );
  useResetSettingsScrollOnFocus();
  return onScroll;
}

/** Solid at scroll rest, frosted when scrolled — Settings stack headers */
export function useChromeFrostedForSettings() {
  const { settingsScrollY } = useNavigationChromeScroll();
  return useDerivedValue(() => {
    return interpolate(
      settingsScrollY.value,
      [0, CHROME_SCROLL_FADE_RANGE],
      [0, 1],
      Extrapolation.CLAMP
    );
  });
}

const tabIndex = (name: string): number => {
  const i = TAB_CHROME_ORDER.indexOf(name as TabChromeRootKey);
  return i >= 0 ? i : 0;
};

/** Frosted amount 0..1 for custom headers on tab roots */
export function useChromeFrostedForTab(tabKey: TabChromeRootKey) {
  const { scrollY } = useNavigationChromeScroll();
  const y = scrollY[tabKey];
  const stackPushed = useSharedValue(0);
  useSyncStackPushedForTab(tabKey, stackPushed);

  return useDerivedValue(() => {
    const scrollPart = interpolate(
      y.value,
      [0, CHROME_SCROLL_FADE_RANGE],
      [0, 1],
      Extrapolation.CLAMP
    );
    return Math.max(scrollPart, stackPushed.value);
  });
}

/** Frosted amount 0..1 for bottom tab bar (active tab + its nested stack) */
export function useChromeFrostedForActiveTab() {
  const { scrollY } = useNavigationChromeScroll();
  const activeTabName = useNavigationState((state) => state.routes[state.index].name as string);
  const idx = useSharedValue(0);
  const stackPushed = useSharedValue(0);

  useEffect(() => {
    idx.value = tabIndex(activeTabName);
  }, [activeTabName, idx]);

  const nestedDepth = useNavigationState((state) => {
    const route = state.routes[state.index];
    const st = route.state as { routes?: unknown[] } | undefined;
    return st?.routes?.length ?? 1;
  });

  useEffect(() => {
    stackPushed.value = nestedDepth > 1 ? 1 : 0;
  }, [nestedDepth, stackPushed]);

  return useDerivedValue(() => {
    const i = Math.round(idx.value);
    let y = 0;
    if (i === 0) y = scrollY.ListTab.value;
    else if (i === 1) y = scrollY.MealsStack.value;
    else if (i === 2) y = scrollY.RecipesStack.value;
    else y = scrollY.ProfileStack.value;

    const scrollPart = interpolate(y, [0, CHROME_SCROLL_FADE_RANGE], [0, 1], Extrapolation.CLAMP);
    return Math.max(scrollPart, stackPushed.value);
  });
}
