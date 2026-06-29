import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, Platform } from 'react-native';
import { ListioPaywallSheet } from '../components/paywall/ListioPaywallSheet';
import {
  MOCK_LISTIO_PAYWALL_PLANS,
  type ListioPaywallPlan,
  type ListioPaywallPlanId,
} from '../components/paywall/listioPaywallContent';
import type { ContextualPaywallReason } from './contextualPaywallReasons';
import { contextualPaywallDismissToast } from './contextualPaywallReasons';
import {
  fetchPremiumEntitlementActive,
  getRevenueCatIosApiKey,
  isRevenueCatNativeLayerSkipped,
  purchaseListioPlusPackage,
  shouldEnforceIosSubscriptionGate,
} from '../services/purchasesService';
import {
  fetchListioPaywallOffering,
  getPackageForPlan,
  type ListioPaywallOffering,
} from '../services/listioPaywallOfferings';
import { ensureServerSubscriptionMirror } from '../services/subscriptionEntitlementSyncService';
import { restorePurchasesWithUserFeedback } from '../services/restorePurchasesFlow';
import { showInfo } from '../utils/appToast';
import { setContextualPaywallPresenter } from './contextualPaywallRef';

type Ctx = {
  /** Presents the Listio+ paywall. Resolves true when the user subscribed or already has premium. */
  presentPaywall: (reason?: ContextualPaywallReason | null) => Promise<boolean>;
  ensurePremiumOrPresentPaywall: (reason: ContextualPaywallReason) => Promise<boolean>;
};

const ListioPaywallContext = createContext<Ctx | null>(null);

type Props = {
  children: React.ReactNode;
  /** Called when RevenueCat reports active entitlement after purchase or restore. */
  onPremiumStatusKnown?: (isPremium: boolean) => void;
};

export function ContextualPaywallProvider({ children, onPremiumStatusKnown }: Props) {
  const [visible, setVisible] = useState(false);
  const [paywallReason, setPaywallReason] = useState<ContextualPaywallReason | null>(null);
  const [plans, setPlans] = useState<ListioPaywallPlan[]>(MOCK_LISTIO_PAYWALL_PLANS);
  const [plansLoading, setPlansLoading] = useState(false);
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const offeringRef = useRef<ListioPaywallOffering | null>(null);
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);
  const dismissReasonRef = useRef<ContextualPaywallReason | null>(null);

  const showDismissToast = useCallback((reason: ContextualPaywallReason) => {
    const { title, message } = contextualPaywallDismissToast(reason);
    showInfo(message, title);
  }, []);

  const closePaywall = useCallback(
    (result: boolean, options?: { showDismissToast?: boolean }) => {
      const resolve = resolveRef.current;
      const reason = dismissReasonRef.current;
      resolveRef.current = null;
      dismissReasonRef.current = null;
      setVisible(false);
      setPaywallReason(null);
      if (!result && options?.showDismissToast !== false && reason) {
        showDismissToast(reason);
      }
      resolve?.(result);
    },
    [showDismissToast]
  );

  const loadOfferings = useCallback(async () => {
    setPlansLoading(true);
    try {
      const offering = await fetchListioPaywallOffering();
      offeringRef.current = offering;
      if (offering?.plans.length) {
        setPlans(offering.plans);
      } else {
        setPlans(MOCK_LISTIO_PAYWALL_PLANS);
      }
    } finally {
      setPlansLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    void loadOfferings();
  }, [visible, loadOfferings]);

  const presentPaywall = useCallback(
    async (reason?: ContextualPaywallReason | null): Promise<boolean> => {
      if (!shouldEnforceIosSubscriptionGate()) {
        onPremiumStatusKnown?.(true);
        return true;
      }
      if (isRevenueCatNativeLayerSkipped()) {
        Alert.alert('Not available', 'Subscriptions aren’t available in this build.');
        return false;
      }
      if (!getRevenueCatIosApiKey()) {
        Alert.alert(
          'Not configured',
          'Subscriptions aren’t set up in this build. Install the App Store version to subscribe.'
        );
        return false;
      }
      const already = await fetchPremiumEntitlementActive();
      if (already) {
        await ensureServerSubscriptionMirror();
        onPremiumStatusKnown?.(true);
        return true;
      }
      return await new Promise<boolean>((resolve) => {
        resolveRef.current = resolve;
        dismissReasonRef.current = reason ?? null;
        setPaywallReason(reason ?? null);
        setVisible(true);
      });
    },
    [onPremiumStatusKnown]
  );

  const ensurePremiumOrPresentPaywall = useCallback(
    (reason: ContextualPaywallReason) => presentPaywall(reason),
    [presentPaywall]
  );

  useEffect(() => {
    setContextualPaywallPresenter(ensurePremiumOrPresentPaywall);
    return () => {
      setContextualPaywallPresenter(null);
      const resolve = resolveRef.current;
      if (resolve) {
        resolveRef.current = null;
        resolve(false);
      }
    };
  }, [ensurePremiumOrPresentPaywall]);

  const handleStartTrial = useCallback(
    async (planId: ListioPaywallPlanId) => {
      if (isRevenueCatNativeLayerSkipped() || !getRevenueCatIosApiKey()) {
        Alert.alert('Not available', 'Subscriptions aren’t set up in this build.');
        return;
      }
      let offering = offeringRef.current;
      if (!offering) {
        offering = await fetchListioPaywallOffering();
        offeringRef.current = offering;
        if (offering?.plans.length) setPlans(offering.plans);
      }
      const pkg = offering ? getPackageForPlan(offering, planId) : undefined;
      if (!pkg) {
        Alert.alert(
          'Plans unavailable',
          'Could not load subscription plans. Check your connection and try again.'
        );
        return;
      }
      setPurchaseBusy(true);
      try {
        const ok = await purchaseListioPlusPackage(pkg);
        onPremiumStatusKnown?.(ok);
        if (ok) {
          closePaywall(true, { showDismissToast: false });
        }
      } catch (e) {
        Alert.alert('Purchase failed', e instanceof Error ? e.message : 'Please try again.');
      } finally {
        setPurchaseBusy(false);
      }
    },
    [closePaywall, onPremiumStatusKnown]
  );

  const handleRestorePurchases = useCallback(async () => {
    setRestoreBusy(true);
    try {
      const ok = await restorePurchasesWithUserFeedback({
        onPremiumActive: () => onPremiumStatusKnown?.(true),
      });
      if (ok) {
        closePaywall(true, { showDismissToast: false });
      }
    } finally {
      setRestoreBusy(false);
    }
  }, [closePaywall, onPremiumStatusKnown]);

  const showRestore = Platform.OS === 'ios' && shouldEnforceIosSubscriptionGate();

  const value = useMemo(
    () => ({ presentPaywall, ensurePremiumOrPresentPaywall }),
    [presentPaywall, ensurePremiumOrPresentPaywall]
  );

  return (
    <ListioPaywallContext.Provider value={value}>
      {children}
      <ListioPaywallSheet
        visible={visible}
        reason={paywallReason}
        plans={plans}
        plansLoading={plansLoading}
        onStartTrial={handleStartTrial}
        onRestore={showRestore ? handleRestorePurchases : undefined}
        onDismiss={() => closePaywall(false)}
        busy={purchaseBusy}
        restoreBusy={restoreBusy}
      />
    </ListioPaywallContext.Provider>
  );
}

export function useContextualPaywall(): Ctx {
  const v = useContext(ListioPaywallContext);
  if (!v) {
    return {
      presentPaywall: async () => {
        if (!shouldEnforceIosSubscriptionGate()) return true;
        const ok = await fetchPremiumEntitlementActive();
        if (ok) await ensureServerSubscriptionMirror();
        return ok;
      },
      ensurePremiumOrPresentPaywall: async (reason: ContextualPaywallReason) => {
        if (!shouldEnforceIosSubscriptionGate()) return true;
        const ok = await fetchPremiumEntitlementActive();
        if (ok) await ensureServerSubscriptionMirror();
        return ok;
      },
    };
  }
  return v;
}

/** @deprecated Use `useContextualPaywall().presentPaywall` */
export function useListioPaywall(): Pick<Ctx, 'presentPaywall'> {
  const { presentPaywall } = useContextualPaywall();
  return { presentPaywall };
}
