import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, Pressable, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../design/ThemeContext';
import { Screen } from '../../components/ui/Screen';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { SecondaryButton } from '../../components/ui/SecondaryButton';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { AppConfirmationDialog } from '../../components/ui/AppConfirmationDialog';
import { SubscriptionLegalLinks } from '../../components/subscription/SubscriptionLegalLinks';
import {
  LISTIO_PLUS_ANNUAL_USD_LABEL,
  LISTIO_PLUS_MONTHLY_USD_LABEL,
} from '../../constants/subscription';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';
import {
  customerInfoHasPremium,
  fetchPremiumEntitlementActive,
  getRevenueCatIosApiKey,
  isRevenueCatNativeLayerSkipped,
  presentAppleSubscriptionManagement,
  presentPaywallForPurchase,
  presentSubscriptionGateAutoPaywall,
  restorePurchases,
} from '../../services/purchasesService';
import { deleteAuthenticatedAccount } from '../../services/deleteAccountService';
import { isSyncEnabled } from '../../services/supabaseClient';
import { clearPersistedQueryCache } from '../../query/reactQueryPersistence';

type Props = {
  onUnlocked: () => void;
};

const LISTIO_PLUS_BENEFITS = [
  'Cloud sync across your devices',
  'Smart categorization of items by aisle (AI)',
  'Paste-to-import recipes with AI ingredient parsing',
  'Weekly meal planning linked to your list',
  'Shopping reminders tuned to your routine',
];

/**
 * Standard auto-renewable subscription disclosure required by App Review Guideline 3.1.2(c)
 * and Schedule 2 of the Apple Developer Program License Agreement.
 */
const APPLE_SUBSCRIPTION_DISCLOSURE =
  'Payment will be charged to your Apple ID account at confirmation of purchase. Your subscription automatically renews for the same term at the standard price shown on the App Store unless auto-renew is turned off at least 24 hours before the end of the current period. Your account will be charged for renewal within 24 hours prior to the end of the current period. You can manage or cancel your subscription at any time in the App Store under Account → Subscriptions.';

export function SubscriptionGateScreen({ onUnlocked }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const tryFinishIfPremium = useCallback(async () => {
    const ok = await fetchPremiumEntitlementActive();
    if (ok) onUnlocked();
  }, [onUnlocked]);

  const missingRevenueCatKey = !getRevenueCatIosApiKey();

  useEffect(() => {
    if (missingRevenueCatKey) return;
    let cancelled = false;
    const run = async () => {
      await presentSubscriptionGateAutoPaywall(() => {
        if (!cancelled) onUnlocked();
      });
      if (cancelled) return;
      await tryFinishIfPremium();
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [missingRevenueCatKey, onUnlocked, tryFinishIfPremium]);

  const handleSubscribe = async () => {
    setBusy(true);
    try {
      const ok = await presentPaywallForPurchase();
      if (ok) onUnlocked();
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    if (isRevenueCatNativeLayerSkipped()) {
      Alert.alert(
        'Not available',
        'In-app purchases are disabled in this build (EXPO_PUBLIC_DISABLE_IOS_SUBSCRIPTION_GATE).'
      );
      return;
    }
    if (!getRevenueCatIosApiKey()) {
      Alert.alert(
        'Not configured',
        'Add EXPO_PUBLIC_REVENUECAT_IOS_API_KEY to your environment and rebuild the app.'
      );
      return;
    }
    setRestoreBusy(true);
    try {
      const info = await restorePurchases();
      if (customerInfoHasPremium(info)) {
        onUnlocked();
      } else {
        Alert.alert(
          'No subscription found',
          'We could not find an active subscription for this Apple ID. You can subscribe below or use a different Apple ID.'
        );
      }
    } catch (e) {
      Alert.alert('Restore failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setRestoreBusy(false);
    }
  };

  const openManage = () => {
    void (async () => {
      try {
        await presentAppleSubscriptionManagement();
      } catch {
        Alert.alert(
          'Could not open',
          'Open the App Store → Account → Subscriptions, or Settings → Apple ID → Subscriptions.'
        );
      }
    })();
  };

  const canDelete = deleteConfirmText.toUpperCase() === 'DELETE';

  const openDeleteSheet = () => {
    setDeleteConfirmText('');
    setShowDeleteSheet(true);
  };

  const closeDeleteSheet = () => {
    if (deleting) return;
    setShowDeleteSheet(false);
    setDeleteConfirmText('');
  };

  const handleDeletePress = () => {
    if (canDelete) setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    setShowDeleteConfirm(false);
    if (!isSyncEnabled()) {
      Alert.alert('Not available', 'Sign in to delete your account.');
      return;
    }
    setDeleting(true);
    try {
      const result = await deleteAuthenticatedAccount();
      if (!result.ok) {
        Alert.alert('Could not delete account', result.message);
        return;
      }
      await clearPersistedQueryCache();
      queryClient.clear();
      setShowDeleteSheet(false);
      setDeleteConfirmText('');
      Alert.alert(
        'Account deleted',
        'Your account and saved data have been removed. You can create a new account any time.'
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Screen padded safeTop={false} safeBottom={false}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: theme.spacing.xl + insets.top,
            paddingBottom: theme.spacing.lg + insets.bottom,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[theme.typography.title2, { color: theme.textPrimary, marginBottom: theme.spacing.sm }]}>
          Subscription required
        </Text>
        <Text style={[theme.typography.title3, { color: theme.textPrimary, marginBottom: theme.spacing.xs }]}>
          Listio+
        </Text>
        <Text
          style={[
            theme.typography.footnote,
            { color: theme.textSecondary, lineHeight: 20, marginBottom: theme.spacing.md },
          ]}
        >
          Auto-renewing subscription. Monthly plan ({LISTIO_PLUS_MONTHLY_USD_LABEL}, 1 month) or annual plan (
          {LISTIO_PLUS_ANNUAL_USD_LABEL}, 1 year). Price in your region and any trial is shown on Apple’s purchase
          sheet before you confirm.
        </Text>

        <Text
          style={[
            theme.typography.subhead,
            { color: theme.textPrimary, marginBottom: theme.spacing.xs },
          ]}
        >
          What you get
        </Text>
        <View style={{ marginBottom: theme.spacing.md }}>
          {LISTIO_PLUS_BENEFITS.map((benefit) => (
            <View key={benefit} style={styles.bulletRow}>
              <Text
                style={[theme.typography.body, { color: theme.textSecondary, lineHeight: 24 }]}
              >
                {'\u2022 '}
                {benefit}
              </Text>
            </View>
          ))}
        </View>

        <Text
          style={[
            theme.typography.footnote,
            {
              color: theme.textSecondary,
              lineHeight: 20,
              marginBottom: theme.spacing.lg,
            },
          ]}
        >
          {APPLE_SUBSCRIPTION_DISCLOSURE}
        </Text>

        {missingRevenueCatKey ? (
          <Text style={[theme.typography.footnote, { color: theme.danger, marginBottom: theme.spacing.lg, lineHeight: 20 }]}>
            This build is missing EXPO_PUBLIC_REVENUECAT_IOS_API_KEY. Add it in your environment (EAS or .env) and rebuild.
          </Text>
        ) : null}
        <PrimaryButton
          title="View plans"
          onPress={handleSubscribe}
          loading={busy}
          disabled={restoreBusy || missingRevenueCatKey}
        />
        <View style={styles.gap} />
        <SecondaryButton title="Restore purchases" onPress={handleRestore} loading={restoreBusy} disabled={busy} />
        <View style={styles.gap} />
        <SecondaryButton title="Manage subscription" onPress={openManage} disabled={busy || restoreBusy} />
        <SubscriptionLegalLinks style={{ marginTop: theme.spacing.xl }} />

        {isSyncEnabled() ? (
          <Pressable
            onPress={openDeleteSheet}
            accessibilityRole="button"
            accessibilityLabel="Delete account"
            hitSlop={8}
            style={styles.deleteLinkRow}
          >
            <Text style={[theme.typography.footnote, { color: theme.danger }]}>
              Delete account
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <BottomSheet
        visible={showDeleteSheet}
        onClose={closeDeleteSheet}
        surfaceVariant="solid"
        size="form"
        keyboardLift="reanimated"
      >
        <View style={styles.sheetWrap}>
          <Text
            style={[
              theme.typography.headline,
              { color: theme.textPrimary, marginBottom: theme.spacing.sm },
            ]}
          >
            Delete account
          </Text>
          <Text
            style={[
              theme.typography.body,
              { color: theme.textSecondary, lineHeight: 22, marginBottom: theme.spacing.md },
            ]}
          >
            This deletes your account and everything in Listio tied to it — lists, meals, and recipes. You can’t get this
            data back.
          </Text>
          <Text
            style={[
              theme.typography.footnote,
              { color: theme.textSecondary, marginBottom: theme.spacing.xs },
            ]}
          >
            Type DELETE to continue
          </Text>
          <TextInput
            style={[
              theme.typography.body,
              styles.deleteInput,
              {
                backgroundColor: theme.surface,
                borderColor: theme.divider,
                color: theme.textPrimary,
              },
            ]}
            value={deleteConfirmText}
            onChangeText={setDeleteConfirmText}
            placeholder="DELETE"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!deleting}
          />
          <View style={{ height: spacing.lg }} />
          <PrimaryButton
            title="Delete account"
            onPress={handleDeletePress}
            disabled={!canDelete || deleting}
            loading={deleting}
            style={{ backgroundColor: theme.danger }}
          />
          <View style={{ height: spacing.sm }} />
          <SecondaryButton
            title="Cancel"
            onPress={closeDeleteSheet}
            disabled={deleting}
          />
        </View>
      </BottomSheet>

      <AppConfirmationDialog
        visible={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete account permanently?"
        message="This cannot be undone. Your account and related information will be removed."
        buttons={[
          { label: 'Cancel', cancel: true, onPress: () => setShowDeleteConfirm(false) },
          { label: 'Delete account', destructive: true, onPress: handleConfirmDelete },
        ]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  gap: { height: spacing.md },
  bulletRow: { marginBottom: 2 },
  deleteLinkRow: {
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    marginTop: spacing.md,
  },
  sheetWrap: {
    paddingBottom: spacing.xl,
  },
  deleteInput: {
    minHeight: 50,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.input,
    borderWidth: 1,
  },
});
