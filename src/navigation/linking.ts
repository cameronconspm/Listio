import type { LinkingOptions } from '@react-navigation/native';
import { resolveExpoLinkingCreateURL } from '../utils/unwrapExpoModule';
import type { RootStackParamList } from './types';

const config = {
  screens: {
    AppTabs: {
      path: '',
      screens: {
        ListTab: 'list',
        MealsStack: 'meals',
        RecipesStack: 'recipes',
        ProfileStack: {
          path: 'settings',
          screens: {
            SettingsHub: '',
          },
        },
      },
    },
  },
} as const;

/**
 * Build linking config without a top-level `expo-linking` import — that loads `ExpoLinking`
 * during App module evaluation (before native runtime is ready).
 */
export function buildRootLinkingOptions(): LinkingOptions<RootStackParamList> {
  const prefixes: string[] = ['listio://'];
  try {
    const createURL = resolveExpoLinkingCreateURL();
    if (createURL) {
      prefixes.unshift(createURL('/'));
    }
  } catch {
    // Dev / cold start: native module not ready yet — listio:// still works for custom scheme.
  }
  return {
    prefixes,
    config,
  } as LinkingOptions<RootStackParamList>;
}
