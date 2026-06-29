import type { ViewStyle } from 'react-native';
import { spacing } from './spacing';

/** Vertical gap between stacked settings / profile section cards. */
export const SETTINGS_SECTION_GAP = spacing.md;

/** Gap between form fields on profile / auth-style settings screens. */
export const SETTINGS_FIELD_GAP = spacing.base;

/** Gap between stacked full-width CTAs (plan, profile save, etc.). */
export const SETTINGS_ACTION_STACK_GAP = spacing.sm;

/** Extra space below the profile tab search header before the first section. */
export const SETTINGS_HUB_TOP_GAP = spacing.sm;

export const settingsSectionStyle: ViewStyle = {
  marginBottom: SETTINGS_SECTION_GAP,
};

export const settingsListSectionProps = {
  titleVariant: 'small' as const,
  glass: false as const,
  dense: true as const,
  style: settingsSectionStyle,
};

export const settingsRowListSectionProps = {
  ...settingsListSectionProps,
  contentFlush: true as const,
};

export const settingsFieldStyle: ViewStyle = {
  marginBottom: SETTINGS_FIELD_GAP,
};

export const settingsFieldLastStyle: ViewStyle = {
  marginBottom: 0,
};

export const settingsMascotHeaderStyle: ViewStyle = {
  alignItems: 'center',
  paddingVertical: spacing.md,
};

export const settingsIntroTextStyle: ViewStyle = {
  marginBottom: SETTINGS_SECTION_GAP,
};

export const settingsActionStackStyle: ViewStyle = {
  alignSelf: 'stretch',
  gap: SETTINGS_ACTION_STACK_GAP,
  marginTop: SETTINGS_SECTION_GAP,
};

export const settingsInlineCardStyle: ViewStyle = {
  paddingVertical: 0,
};
