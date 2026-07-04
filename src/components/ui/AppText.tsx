import React from 'react';
import { Text, type TextProps } from 'react-native';

/** Caps scaling for faux UI inside marketing previews so layouts stay stable. */
export const DECORATIVE_MAX_FONT_SIZE_MULTIPLIER = 1.2;

type AppTextProps = TextProps & {
  /** `content` — full Dynamic Type; `decorative` — capped for preview mockups. */
  variant?: 'content' | 'decorative';
};

/**
 * Text wrapper with tiered Dynamic Type policy.
 * Use `decorative` inside onboarding carousel / preview cards only.
 */
export function AppText({
  variant = 'content',
  maxFontSizeMultiplier,
  ...props
}: AppTextProps) {
  const resolvedMultiplier =
    maxFontSizeMultiplier ??
    (variant === 'decorative' ? DECORATIVE_MAX_FONT_SIZE_MULTIPLIER : undefined);

  return <Text maxFontSizeMultiplier={resolvedMultiplier} {...props} />;
}
