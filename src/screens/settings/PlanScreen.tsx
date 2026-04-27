import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../design/ThemeContext';
import { useSettingsScrollHandler } from '../../navigation/NavigationChromeScrollContext';
import { Screen } from '../../components/ui/Screen';
import { useSettingsScrollInsets } from './settingsScrollLayout';
import { ListSection } from '../../components/ui/ListSection';
import { ListRow } from '../../components/ui/ListRow';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { SubscriptionLegalLinks } from '../../components/subscription/SubscriptionLegalLinks';
import {
  isIosSubscriptionGateDisabledViaEnv,
  LISTIO_PLUS_ANNUAL_USD_LABEL,
  LISTIO_PLUS_MONTHLY_USD_LABEL,
} from '../../constants/subscription';
import { isSyncEnabled } from '../../services/supabaseClient';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';
import {
  fetchPremiumEntitlementActive,
  getRevenueCatIosApiKey,
  presentAppleSubscriptionManagement,
  presentPaywallForPurchase,
  shouldEnforceIosSubscriptionGate,
} from '../../services/purchasesService';

export function PlanScreen() {
  const onScroll = useSettingsScrollHandler();
  const scrollInsets = useSettingsScrollInsets();
  const theme = useTheme();
  const syncOn = isSyncEnabled();
  const reviewSubscriptionBypass = Platform.OS === 'ios' && isIosSubscriptionGateDisabledViaEnv();
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [paywallBusy, setPaywallBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        if (Platform.OS !== 'ios' || !shouldEnforceIosSubscriptionGate()) {
          if (!cancelled) setSubscribed(null);
          return;
        }
        const ok = await fetchPremiumEntitlementActive();
        if (!cancelled) setSubscribed(ok);
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const handleSubscribe = async () => {
    if (!getRevenueCatIosApiKey()) {
      Alert.alert('Not configured', 'Add EXPO_PUBLIC_REVENUECAT_IOS_API_KEY and rebuild.');
      return;
    }
    setPaywallBusy(true);
    try {
      const ok = await presentPaywallForPurchase();
      if (ok) setSubscribed(true);
    } finally {
      setPaywallBusy(false);
    }
  };

  const openManage = () => {
    void (async () => {
      try {
        await presentAppleSubscriptionManagement();
      } catch {
        Alert.alert(
          'Could not open',
          'Open the App Store, tap your account picture, then Subscriptions. Or go to Settings → Subscriptions.'
        );
      }
    })();
  };

  const planTitle = reviewSubscriptionBypass
    ? 'Subscriptions paused'
    : Platform.OS !== 'ios'
      ? 'Listio on iPhone'
      : subscribed === true
        ? 'Listio+'
        : subscribed === false
          ? 'Not subscribed'
          : '…';

  const planBody = reviewSubscriptionBypass
    ? 'Purchases aren’t available in this preview build. Install the App Store version to subscribe.'
    : Platform.OS !== 'ios'
      ? 'Subscribe on iPhone to unlock everything. Pricing is shown when you subscribe.'
      : subscribed === true
        ? 'Thank you for supporting Listio. You have access to all features included in your plan.'
        : subscribed === false
          ? `Subscribe for ${LISTIO_PLUS_MONTHLY_USD_LABEL} or ${LISTIO_PLUS_ANNUAL_USD_LABEL} to use Listio on this device. Price may vary by region.`
          : 'Checking your plan…';

  return (
    <Screen padded safeTop={false} safeBottom={false}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: scrollInsets.paddingTop,
            paddingBottom: scrollInsets.paddingBottom,
          },
        ]}
        onScroll={onScroll}
        scrollEventThrottle={scrollInsets.scrollEventThrottle}
        contentInsetAdjustmentBehavior={scrollInsets.contentInsetBehavior}
        showsVerticalScrollIndicator={false}
      >
        <ListSection title="Current plan" titleVariant="small" glass={false} style={styles.section}>
          <View style={[styles.planCard, { backgroundColor: theme.surface }]}>
            <Text style={[theme.typography.title3, { color: theme.textPrimary, marginBottom: theme.spacing.xs }]}>
              {planTitle}
            </Text>
            <Text style={[theme.typography.footnote, { color: theme.textSecondary, lineHeight: 20 }]}>
              {planBody}
            </Text>
          </View>
        </ListSection>

        {Platform.OS === 'ios' && shouldEnforceIosSubscriptionGate() && subscribed === false ? (
          <ListSection title="Upgrade" titleVariant="small" glass={false} style={styles.section}>
            <View style={[styles.ctaCard, { backgroundColor: theme.surface }]}>
              <Text
                style={[
                  theme.typography.footnote,
                  { color: theme.textSecondary, lineHeight: 20, marginBottom: theme.spacing.md },
                ]}
              >
                Listio+ monthly ({LISTIO_PLUS_MONTHLY_USD_LABEL}) or yearly ({LISTIO_PLUS_ANNUAL_USD_LABEL}). Cancel
                anytime in Settings.
              </Text>
              <PrimaryButton title="View plans" onPress={handleSubscribe} loading={paywallBusy} />
            </View>
          </ListSection>
        ) : null}

        <ListSection title="Included with Listio+" titleVariant="small" glass={false} style={styles.section}>
          <ListRow
            title="Sync across devices"
            rightAccessory={
              <Text style={[theme.typography.footnote, { color: syncOn ? theme.accent : theme.textSecondary }]}>
                {syncOn ? 'On' : 'Sign in'}
              </Text>
            }
            showSeparator
            fullWidthDivider
          />
          <ListRow
            title="Advanced planning tools"
            rightAccessory={
              <Text style={[theme.typography.footnote, { color: theme.textSecondary }]}>Coming soon</Text>
            }
            showSeparator={false}
            fullWidthDivider
          />
        </ListSection>

        {Platform.OS === 'ios' && shouldEnforceIosSubscriptionGate() && subscribed === true ? (
          <ListSection title="Billing" titleVariant="small" glass={false} style={styles.section}>
            <ListRow
              title="Manage subscription"
              subtitle="Cancel, change plan, or update payment"
              onPress={openManage}
              showSeparator={false}
              fullWidthDivider
            />
          </ListSection>
        ) : null}

        {Platform.OS === 'ios' ? (
          <View style={[styles.legalFooter, { marginBottom: spacing.lg }]}>
            <SubscriptionLegalLinks />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {},
  section: { marginBottom: spacing.lg },
  planCard: {
    padding: spacing.md,
    borderRadius: radius.card,
  },
  ctaCard: {
    padding: spacing.md,
    borderRadius: radius.card,
  },
  legalFooter: {
    alignItems: 'center',
  },
});
