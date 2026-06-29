import type { ViewStyle } from 'react-native';
import { spacing } from './spacing';

/** Vertical gap between auth form fields inside a card (tighter than default TextField md). */
export const AUTH_FIELD_GAP = spacing.base;

/** Space between the last field and an inline link (e.g. forgot password). */
export const AUTH_FIELD_TO_LINK_GAP = 0;

/** Space between an inline link and the primary CTA. */
export const AUTH_LINK_TO_PRIMARY_GAP = spacing.sm;

/** Section break between primary email CTA and OAuth providers. */
export const AUTH_PRIMARY_TO_PROVIDERS_GAP = spacing.sm;

/** Gap between stacked OAuth provider buttons. */
export const AUTH_PROVIDER_GAP = spacing.sm;

/** Vertical padding on the “or” divider row. */
export const AUTH_PROVIDER_DIVIDER_PAD = spacing.xxs;

/** Gap between the “or” divider and the first provider button. */
export const AUTH_PROVIDER_DIVIDER_TO_BUTTON_GAP = spacing.xs;

/** Space below hero / value strip before the form card. */
export const AUTH_HERO_TO_CARD_GAP = spacing.md;

/** Space below the form card before footer links. */
export const AUTH_CARD_TO_FOOTER_GAP = spacing.lg;

export const authFieldContainerStyle: ViewStyle = {
  marginBottom: AUTH_FIELD_GAP,
};

/** Last text field before trailing inline actions (forgot password, etc.). */
export const authFieldBeforeLinkStyle: ViewStyle = {
  marginBottom: AUTH_FIELD_TO_LINK_GAP,
};

export const authForgotLinkStyle: ViewStyle = {
  alignSelf: 'flex-end',
  minHeight: 44,
  justifyContent: 'flex-start',
  marginBottom: AUTH_LINK_TO_PRIMARY_GAP,
};

export const authFooterLinkStyle: ViewStyle = {
  alignSelf: 'center',
  minHeight: 44,
  justifyContent: 'center',
  paddingVertical: spacing.sm,
};

export const authCardStyle: ViewStyle = {
  marginBottom: AUTH_CARD_TO_FOOTER_GAP,
};

/** Form card immediately after hero / value strip (login). */
export const authCardAfterHeroStyle: ViewStyle = {
  marginTop: AUTH_HERO_TO_CARD_GAP,
  marginBottom: AUTH_CARD_TO_FOOTER_GAP,
};
