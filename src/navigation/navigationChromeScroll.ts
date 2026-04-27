import type { TabsParamList } from './types';

/** Tab navigator route names — scroll + chrome state are keyed by these */
export type TabChromeRootKey = keyof TabsParamList;

export const TAB_CHROME_ORDER: TabChromeRootKey[] = [
  'ListTab',
  'MealsStack',
  'RecipesStack',
  'ProfileStack',
];

/** Scroll distance (px) over which chrome fades from solid → frosted */
export const CHROME_SCROLL_FADE_RANGE = 22;
