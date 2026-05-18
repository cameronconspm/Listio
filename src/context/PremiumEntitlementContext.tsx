import React, { createContext, useContext, useMemo } from 'react';

type Ctx = {
  /** True when RevenueCat reports active `premium` entitlement (or gate disabled). */
  isPremium: boolean;
  /** True while iOS subscription gate is on and entitlement has not been resolved yet. */
  isPremiumLoading: boolean;
};

const PremiumEntitlementContext = createContext<Ctx | null>(null);

export function PremiumEntitlementProvider({
  isPremium,
  isPremiumLoading,
  children,
}: {
  isPremium: boolean;
  isPremiumLoading: boolean;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ isPremium, isPremiumLoading }), [isPremium, isPremiumLoading]);
  return (
    <PremiumEntitlementContext.Provider value={value}>{children}</PremiumEntitlementContext.Provider>
  );
}

export function usePremiumEntitlement(): Ctx {
  const v = useContext(PremiumEntitlementContext);
  if (!v) {
    return { isPremium: true, isPremiumLoading: false };
  }
  return v;
}
