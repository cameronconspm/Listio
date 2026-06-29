/** App Store product identifiers — must match RevenueCat and App Store Connect. */
export const LISTIO_PREMIUM_PRODUCT_IDS = {
  monthly: 'listio_premium_monthly',
  annual: 'listio_premium_annual',
} as const;

export type ListioPremiumProductId =
  (typeof LISTIO_PREMIUM_PRODUCT_IDS)[keyof typeof LISTIO_PREMIUM_PRODUCT_IDS];
