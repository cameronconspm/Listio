import type { ThemeSpacing } from '../../design/layout';

/** Layout constants for onboarding — use `createOnboardingLayout(theme.spacing)` for scaled values. */
export function createOnboardingLayout(spacing: ThemeSpacing) {
  return {
    horizontalPadding: spacing.lg,
    /**
     * Extra scroll padding below content (added to `insets.bottom` in `OnboardingFlowScreen`).
     * Clears the pinned CTA row in `OnboardingBottomCta` (padding + button height).
     */
    scrollBottomInset: 96,
    /** Extra top padding below progress chrome (scroll uses `paddingTop` if needed). */
    contentTopPadding: 0,
    /** Space between the progress bar and the step headline — keep comfortably above `spacing.xs`. */
    chromeBottomPadding: spacing.md,
    progressTrackHeight: 2,
    headlineToBody: spacing.sm,
    /** Gap between intro paragraph and welcome preview on step 0. */
    firstPageBodyToFeatured: spacing.md,
    bodyToFeatured: spacing.lg,
    featuredToFooter: spacing.xl,
  } as const;
}

/** Subtle vertical page tint — pairs with theme.background. */
export const onboardingPageGradient = {
  light: ['#EFECE4', '#F7F6F2', '#F7F6F2'] as const,
  dark: ['#121212', '#0d0d0d', '#0d0d0d'] as const,
};
