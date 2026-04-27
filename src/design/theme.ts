import { lightTokens, darkTokens, type SemanticTokenKey } from './tokens';

export type ColorScheme = 'light' | 'dark';

export const theme = {
  light: lightTokens,
  dark: darkTokens,
} as const;

export function getTheme(scheme: ColorScheme): Record<SemanticTokenKey, string> {
  return scheme === 'dark' ? darkTokens : lightTokens;
}
