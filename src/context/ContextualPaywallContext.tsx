import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../design/ThemeContext';
import { BottomSheet } from '../components/ui/BottomSheet';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { SecondaryButton } from '../components/ui/SecondaryButton';
import {
  contextualPaywallBody,
  contextualPaywallHeadline,
  type ContextualPaywallReason,
} from './contextualPaywallReasons';
import {
  fetchPremiumEntitlementActive,
  presentPaywallForPurchase,
  shouldEnforceIosSubscriptionGate,
} from '../services/purchasesService';
import { ensureServerSubscriptionMirror } from '../services/subscriptionEntitlementSyncService';
import { setContextualPaywallPresenter } from './contextualPaywallRef';
import { spacing } from '../design/spacing';

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
  const theme = useTheme();
  const [pendingReason, setPendingReason] = useState<ContextualPaywallReason | null>(null);
  const [busy, setBusy] = useState(false);
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);

  const closeSheet = useCallback((result: boolean) => {
    const r = resolveRef.current;
    if (!r) return;
    resolveRef.current = null;
    setPendingReason(null);
    r(result);
  }, []);

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
      closeSheet(ok);
    } finally {
      setBusy(false);
    }
  }, [closeSheet, onPremiumStatusKnown]);

  const handleNotNow = useCallback(() => {
    closeSheet(false);
  }, [closeSheet]);

  const value = useMemo(
    () => ({ ensurePremiumOrPresentPaywall }),
    [ensurePremiumOrPresentPaywall]
  );

  return (
    <ContextualPaywallContext.Provider value={value}>
      {children}
      <BottomSheet
        visible={pendingReason !== null}
        onClose={() => closeSheet(false)}
        surfaceVariant="solid"
        size="default"
        interactiveDismiss
        padContent
      >
        {pendingReason ? (
          <View style={styles.sheetInner}>
            <Text style={[theme.typography.title3, { color: theme.textPrimary, marginBottom: spacing.sm }]}>
              {contextualPaywallHeadline(pendingReason)}
            </Text>
            <Text
              style={[
                theme.typography.body,
                { color: theme.textSecondary, lineHeight: 22, marginBottom: spacing.lg },
              ]}
            >
              {contextualPaywallBody(pendingReason)}
            </Text>
            <PrimaryButton title="See plans" onPress={() => void handleSeePlans()} loading={busy} disabled={busy} />
            <View style={{ height: spacing.sm }} />
            <SecondaryButton title="Not now" onPress={handleNotNow} disabled={busy} />
          </View>
        ) : null}
      </BottomSheet>
    </ContextualPaywallContext.Provider>
  );
}

const styles = StyleSheet.create({
  sheetInner: {
    paddingBottom: spacing.md,
  },
});

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
