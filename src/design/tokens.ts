/** Semantic color keys; `surfaceGlassSheet` is for frosted bottom sheets (lighter fill than `surfaceGlass`). */
export const semanticTokenKeys = [
  'background',
  'surface',
  /** Grouped cards and list sections — one step above page background on dark. */
  'surfaceRaised',
  /** Hairline edge for raised surfaces when shadows don't read (especially dark mode). */
  'surfaceBorder',
  'surfaceGlass',
  'surfaceGlassSheet',
  'textPrimary',
  'textSecondary',
  'accent',
  'danger',
  'divider',
  'onAccent',
  'onDanger',
] as const;

export type SemanticTokenKey = (typeof semanticTokenKeys)[number];

export const lightTokens: Record<SemanticTokenKey, string> = {
  background: '#F7F6F2',
  surface: '#ffffff',
  surfaceRaised: '#ffffff',
  surfaceBorder: 'rgba(60, 60, 67, 0.14)',
  surfaceGlass: 'rgba(255, 255, 255, 0.72)',
  /** Sheet tint over BlurView — keep low so blurred content behind stays faintly visible. */
  surfaceGlassSheet: 'rgba(255, 255, 255, 0.34)',
  textPrimary: '#1c1c1e',
  textSecondary: '#8e8e93',
  accent: '#2d8a5e',
  danger: '#ff3b30',
  divider: 'rgba(60, 60, 67, 0.12)',
  onAccent: '#ffffff',
  onDanger: '#ffffff',
};

export const darkTokens: Record<SemanticTokenKey, string> = {
  background: '#0d0d0d',
  surface: '#1c1c1e',
  surfaceRaised: '#262628',
  surfaceBorder: 'rgba(255, 255, 255, 0.08)',
  surfaceGlass: 'rgba(44, 44, 46, 0.72)',
  surfaceGlassSheet: 'rgba(44, 44, 46, 0.38)',
  textPrimary: '#ffffff',
  textSecondary: '#8e8e93',
  accent: '#34c759',
  danger: '#ff453a',
  divider: 'rgba(84, 84, 88, 0.65)',
  onAccent: '#ffffff',
  onDanger: '#ffffff',
};
