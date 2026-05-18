import type { ThemeSpacing } from '../../design/layout';
import { roundPx } from '../../design/layoutMetrics';

/** Layout constants for onboarding — pass `theme.layoutScale` for device-aware insets. */
export function createOnboardingLayout(spacing: ThemeSpacing, layoutScale = 1) {
  return {
    horizontalPadding: spacing.lg,
    /**
     * Extra scroll padding below content (added to `insets.bottom` in `OnboardingFlowScreen`).
     * Clears the pinned CTA row in `OnboardingBottomCta` (padding + button height).
     */
    scrollBottomInset: roundPx(96 * layoutScale),
    /** Extra top padding below progress chrome (scroll uses `paddingTop` if needed). */
    contentTopPadding: 0,
    /** Space between the progress bar and the step headline — keep comfortably above `spacing.xs`. */
    chromeBottomPadding: spacing.md,
    progressTrackHeight: roundPx(2 * layoutScale),
    headlineToBody: spacing.sm,
    /** Gap between intro paragraph and welcome preview on step 0. */
    firstPageBodyToFeatured: spacing.md,
    bodyToFeatured: spacing.lg,
    featuredToFooter: spacing.xl,
  } as const;
}

/** Subtle vertical page tint — pairs with theme.background. */
export const onboardingPageGradient = {
  light: ['#EFECE4', '#F5F3EE', '#F7F6F2'] as const,
  dark: ['#141414', '#0d0d0d', '#0a0a0a'] as const,
};
