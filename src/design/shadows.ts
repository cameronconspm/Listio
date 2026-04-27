import type { ViewStyle } from 'react-native';
import { Platform } from 'react-native';

const elevationShadow = (elevation: number): ViewStyle =>
  Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: elevation / 2 },
      shadowOpacity: 0.12,
      shadowRadius: elevation,
    },
    android: { elevation },
    default: {},
  }) as ViewStyle;

/** Very subtle shadow for glass surfaces (Liquid Glass). */
const glassShadow: ViewStyle = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  android: { elevation: 1 },
  default: {},
}) as ViewStyle;

/**
 * Shared depth tiers for consistent layering. Soft, premium, lightweight.
 * Tier 0: Page background — no shadow
 * Tier 1: Grouped cards
 * Tier 2: Elevated controls (selected thumb, etc.)
 * Tier 3: Floating actions, sheets, dialogs
 */
const depthCard: ViewStyle = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  android: { elevation: 2 },
  default: {},
}) as ViewStyle;

const depthElevated: ViewStyle = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  android: { elevation: 3 },
  default: {},
}) as ViewStyle;

const depthFloating: ViewStyle = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
  },
  android: { elevation: 8 },
  default: {},
}) as ViewStyle;

/** Very subtle thumb shadow for toggles. */
const depthThumb: ViewStyle = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  android: { elevation: 2 },
  default: {},
}) as ViewStyle;

export const shadows = {
  sm: elevationShadow(2),
  md: elevationShadow(4),
  lg: elevationShadow(8),
  glass: glassShadow,
  /** Tier 1: Grouped card surfaces */
  card: depthCard,
  /** Tier 2: Elevated controls (selected pill, etc.) */
  elevated: depthElevated,
  /** Tier 3: FAB, sheets, dialogs */
  floating: depthFloating,
  /** Toggle thumb only */
  thumb: depthThumb,
} as const;
