import React, { createContext, useContext } from 'react';

type Ctx = {
  startReplayOnboarding: () => void;
  resetOnboardingCompletion: () => Promise<void>;
};

const OnboardingControlsContext = createContext<Ctx | null>(null);

export function OnboardingControlsProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: Ctx;
}) {
  return (
    <OnboardingControlsContext.Provider value={value}>{children}</OnboardingControlsContext.Provider>
  );
}

export function useOnboardingControls(): Ctx {
  const v = useContext(OnboardingControlsContext);
  if (!v) {
    return {
      startReplayOnboarding: () => {},
      resetOnboardingCompletion: async () => {},
    };
  }
  return v;
}
