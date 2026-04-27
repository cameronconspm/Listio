/** Semantic color keys; `surfaceGlassSheet` is for frosted bottom sheets (lighter fill than `surfaceGlass`). */
export const semanticTokenKeys = [
  'background',
  'surface',
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
