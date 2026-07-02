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
import { resolveLivePaywallPresentation } from './paywallPresentationLogic';
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
import { logger } from '../utils/logger';
import { setContextualPaywallPresenter } from './contextualPaywallRef';

export type PresentPaywallOptions = {
  /** Show a toast when the paywall is skipped (gate off or already premium). */
  feedbackOnSkip?: boolean;
};

type Ctx = {
  /** Presents the Listio+ paywall. Resolves true when the user subscribed or already has premium. */
  presentPaywall: (
    reason?: ContextualPaywallReason | null,
    options?: PresentPaywallOptions
  ) => Promise<boolean>;
  /** QA preview — always shows the paywall UI with mock plans; purchases disabled. */
  presentPaywallPreview: (reason?: ContextualPaywallReason | null) => Promise<void>;
  ensurePremiumOrPresentPaywall: (reason: ContextualPaywallReason) => Promise<boolean>;
};

const ListioPaywallContext = createContext<Ctx | null>(null);

type Props = {
  children: React.ReactNode;
  /** Called when RevenueCat reports active entitlement after purchase or restore. */
  onPremiumStatusKnown?: (isPremium: boolean) => void;
};

function paywallSkipToast(reason: 'gate_disabled' | 'already_premium'): void {
  if (reason === 'gate_disabled') {
    showInfo('Subscriptions are disabled in this build.', 'Paywall skipped');
    return;
  }
  showInfo('You already have Listio+ on this device.', 'Already subscribed');
}

export function ContextualPaywallProvider({ children, onPremiumStatusKnown }: Props) {
  const [visible, setVisible] = useState(false);
  const [previewOnly, setPreviewOnly] = useState(false);
  const [paywallReason, setPaywallReason] = useState<ContextualPaywallReason | null>(null);
  const [plans, setPlans] = useState<ListioPaywallPlan[]>(MOCK_LISTIO_PAYWALL_PLANS);
  const [plansLoading, setPlansLoading] = useState(false);
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const offeringRef = useRef<ListioPaywallOffering | null>(null);
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);
  const previewResolveRef = useRef<(() => void) | null>(null);
  const dismissReasonRef = useRef<ContextualPaywallReason | null>(null);

  const showDismissToast = useCallback((reason: ContextualPaywallReason) => {
    const { title, message } = contextualPaywallDismissToast(reason);
    showInfo(message, title);
  }, []);

  const closePaywall = useCallback(
    (result: boolean, options?: { showDismissToast?: boolean }) => {
      const resolve = resolveRef.current;
      const previewResolve = previewResolveRef.current;
      const reason = dismissReasonRef.current;
      const wasPreview = previewOnly;
      resolveRef.current = null;
      previewResolveRef.current = null;
      dismissReasonRef.current = null;
      setVisible(false);
      setPaywallReason(null);
      setPreviewOnly(false);
      if (!wasPreview && !result && options?.showDismissToast !== false && reason) {
        showDismissToast(reason);
      }
      previewResolve?.();
      resolve?.(result);
    },
    [previewOnly, showDismissToast]
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
    if (!visible || previewOnly) return;
    void loadOfferings();
  }, [visible, previewOnly, loadOfferings]);

  const openPaywallSheet = useCallback((reason: ContextualPaywallReason | null) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      dismissReasonRef.current = reason;
      setPaywallReason(reason);
      setVisible(true);
    });
  }, []);

  const presentPaywall = useCallback(
    async (
      reason?: ContextualPaywallReason | null,
      options?: PresentPaywallOptions
    ): Promise<boolean> => {
      const decision = resolveLivePaywallPresentation({
        platformIos: Platform.OS === 'ios',
        gateEnforced: shouldEnforceIosSubscriptionGate(),
        rcSkipped: isRevenueCatNativeLayerSkipped(),
        hasApiKey: getRevenueCatIosApiKey().length > 0,
        alreadyPremium: false,
      });

      if (decision.action === 'alert') {
        if (decision.reason === 'not_ios') {
          Alert.alert('Not available', 'The paywall is currently iOS-only.');
        } else if (decision.reason === 'rc_skipped') {
          Alert.alert('Not available', 'Subscriptions aren’t available in this build.');
        } else if (decision.reason === 'no_api_key') {
          Alert.alert(
            'Not configured',
            'Subscriptions aren’t set up in this build. Install the App Store version to subscribe.'
          );
        }
        logger.warnRelease(`paywall: blocked (${decision.reason})`);
        return false;
      }

      if (decision.action === 'skip' && decision.reason === 'gate_disabled') {
        logger.warnRelease('paywall: skipped (gate_disabled)');
        if (options?.feedbackOnSkip) paywallSkipToast('gate_disabled');
        onPremiumStatusKnown?.(true);
        return true;
      }

      const already = await fetchPremiumEntitlementActive();
      if (already) {
        logger.warnRelease('paywall: skipped (already_premium)');
        if (options?.feedbackOnSkip) paywallSkipToast('already_premium');
        await ensureServerSubscriptionMirror();
        onPremiumStatusKnown?.(true);
        return true;
      }

      offeringRef.current = null;
      setPreviewOnly(false);
      return openPaywallSheet(reason ?? null);
    },
    [onPremiumStatusKnown, openPaywallSheet]
  );

  const presentPaywallPreview = useCallback(
    async (reason?: ContextualPaywallReason | null): Promise<void> => {
      if (Platform.OS !== 'ios') {
        Alert.alert('Not available', 'The paywall is currently iOS-only.');
        return;
      }
      logger.warnRelease('paywall: preview mode');
      offeringRef.current = null;
      setPlans(MOCK_LISTIO_PAYWALL_PLANS);
      setPlansLoading(false);
      setPreviewOnly(true);
      await new Promise<void>((resolve) => {
        previewResolveRef.current = resolve;
        dismissReasonRef.current = reason ?? null;
        setPaywallReason(reason ?? null);
        setVisible(true);
      });
    },
    []
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
      previewResolveRef.current = null;
    };
  }, [ensurePremiumOrPresentPaywall]);

  const handleStartTrial = useCallback(
    async (planId: ListioPaywallPlanId) => {
      if (previewOnly) {
        Alert.alert('Preview only', 'Purchases are disabled in paywall preview mode.');
        return;
      }
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
    [closePaywall, onPremiumStatusKnown, previewOnly]
  );

  const handleRestorePurchases = useCallback(async () => {
    if (previewOnly) return;
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
  }, [closePaywall, onPremiumStatusKnown, previewOnly]);

  const showRestore = Platform.OS === 'ios' && shouldEnforceIosSubscriptionGate() && !previewOnly;

  const value = useMemo(
    () => ({ presentPaywall, presentPaywallPreview, ensurePremiumOrPresentPaywall }),
    [presentPaywall, presentPaywallPreview, ensurePremiumOrPresentPaywall]
  );

  return (
    <ListioPaywallContext.Provider value={value}>
      {children}
      <ListioPaywallSheet
        visible={visible}
        reason={paywallReason}
        plans={plans}
        plansLoading={plansLoading}
        previewOnly={previewOnly}
        onStartTrial={handleStartTrial}
        onRestore={showRestore ? handleRestorePurchases : undefined}
        onDismiss={() => closePaywall(false, { showDismissToast: !previewOnly })}
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
      presentPaywallPreview: async () => {},
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
