import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { ContextualPaywallOverlay } from '../components/paywall/ContextualPaywallOverlay';
import type { ContextualPaywallReason } from './contextualPaywallReasons';
import { contextualPaywallDismissToast } from './contextualPaywallReasons';
import {
  fetchPremiumEntitlementActive,
  presentPaywallForPurchase,
  shouldEnforceIosSubscriptionGate,
} from '../services/purchasesService';
import { ensureServerSubscriptionMirror } from '../services/subscriptionEntitlementSyncService';
import { restorePurchasesWithUserFeedback } from '../services/restorePurchasesFlow';
import { showInfo } from '../utils/appToast';
import { setContextualPaywallPresenter } from './contextualPaywallRef';

type Ctx = {
  ensurePremiumOrPresentPaywall: (reason: ContextualPaywallReason) => Promise<boolean>;
};

const ContextualPaywallContext = createContext<Ctx | null>(null);

type Props = {
  children: React.ReactNode;
  /** Called when RevenueCat reports active entitlement after purchase or restore. */
  onPremiumStatusKnown?: (isPremium: boolean) => void;
};

export function ContextualPaywallProvider({ children, onPremiumStatusKnown }: Props) {
  const [pendingReason, setPendingReason] = useState<ContextualPaywallReason | null>(null);
  const [busy, setBusy] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);
  const dismissReasonRef = useRef<ContextualPaywallReason | null>(null);

  const showDismissToast = useCallback((reason: ContextualPaywallReason) => {
    const { title, message } = contextualPaywallDismissToast(reason);
    showInfo(message, title);
  }, []);

  const closeSheet = useCallback(
    (result: boolean, options?: { showDismissToast?: boolean }) => {
      const r = resolveRef.current;
      const reason = dismissReasonRef.current;
      if (!r) return;
      resolveRef.current = null;
      dismissReasonRef.current = null;
      setPendingReason(null);
      if (!result && options?.showDismissToast !== false && reason) {
        showDismissToast(reason);
      }
      r(result);
    },
    [showDismissToast]
  );

  const ensurePremiumOrPresentPaywall = useCallback(
    async (reason: ContextualPaywallReason): Promise<boolean> => {
      if (!shouldEnforceIosSubscriptionGate()) {
        onPremiumStatusKnown?.(true);
        return true;
      }
      const already = await fetchPremiumEntitlementActive();
      if (already) {
        await ensureServerSubscriptionMirror();
        onPremiumStatusKnown?.(true);
        return true;
      }
      return await new Promise<boolean>((resolve) => {
        resolveRef.current = resolve;
        dismissReasonRef.current = reason;
        setPendingReason(reason);
      });
    },
    [onPremiumStatusKnown]
  );

  useEffect(() => {
    setContextualPaywallPresenter(ensurePremiumOrPresentPaywall);
    return () => {
      setContextualPaywallPresenter(null);
      const r = resolveRef.current;
      if (r) {
        resolveRef.current = null;
        r(false);
      }
    };
  }, [ensurePremiumOrPresentPaywall]);

  const handleSeePlans = useCallback(async () => {
    setBusy(true);
    try {
      const ok = await presentPaywallForPurchase();
      onPremiumStatusKnown?.(ok);
      closeSheet(ok, { showDismissToast: !ok });
    } finally {
      setBusy(false);
    }
  }, [closeSheet, onPremiumStatusKnown]);

  const handleNotNow = useCallback(() => {
    closeSheet(false);
  }, [closeSheet]);

  const handleRestorePurchases = useCallback(async () => {
    setRestoreBusy(true);
    try {
      const ok = await restorePurchasesWithUserFeedback({
        onPremiumActive: () => onPremiumStatusKnown?.(true),
      });
      if (ok) {
        closeSheet(true, { showDismissToast: false });
      }
    } finally {
      setRestoreBusy(false);
    }
  }, [closeSheet, onPremiumStatusKnown]);

  const showRestore =
    Platform.OS === 'ios' && shouldEnforceIosSubscriptionGate();

  const value = useMemo(
    () => ({ ensurePremiumOrPresentPaywall }),
    [ensurePremiumOrPresentPaywall]
  );

  return (
    <ContextualPaywallContext.Provider value={value}>
      {children}
      <ContextualPaywallOverlay
        visible={pendingReason !== null}
        reason={pendingReason}
        onSeePlans={handleSeePlans}
        onNotNow={handleNotNow}
        onRestorePurchases={showRestore ? handleRestorePurchases : undefined}
        busy={busy}
        restoreBusy={restoreBusy}
      />
    </ContextualPaywallContext.Provider>
  );
}

export function useContextualPaywall(): Ctx {
  const v = useContext(ContextualPaywallContext);
  if (!v) {
    return {
      ensurePremiumOrPresentPaywall: async () => {
        if (!shouldEnforceIosSubscriptionGate()) return true;
        const ok = await fetchPremiumEntitlementActive();
        if (ok) await ensureServerSubscriptionMirror();
        return ok;
      },
    };
  }
  return v;
}
