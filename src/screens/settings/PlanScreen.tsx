import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, Alert, ActivityIndicator } from 'react-native';
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
import {
  SETTINGS_SECTION_GAP,
  settingsListSectionProps,
  settingsRowListSectionProps,
} from '../../design/settingsLayout';
import {
  fetchPremiumEntitlementActive,
  getRevenueCatIosApiKey,
  presentAppleSubscriptionManagement,
  shouldEnforceIosSubscriptionGate,
} from '../../services/purchasesService';
import { useContextualPaywall } from '../../context/ContextualPaywallContext';
import { ensureServerSubscriptionMirror } from '../../services/subscriptionEntitlementSyncService';
import { restorePurchasesWithUserFeedback } from '../../services/restorePurchasesFlow';
import { SettingsPushedScreenHeader } from './SettingsPushedScreenHeader';
import { Chevron } from './SettingsChevron';

export function PlanScreen() {
  const onScroll = useSettingsScrollHandler();
  const scrollInsets = useSettingsScrollInsets();
  const theme = useTheme();
  const syncOn = isSyncEnabled();
  const { presentPaywall } = useContextualPaywall();
  const reviewSubscriptionBypass = Platform.OS === 'ios' && isIosSubscriptionGateDisabledViaEnv();
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [paywallBusy, setPaywallBusy] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);

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
        if (ok) void ensureServerSubscriptionMirror();
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const handleSubscribe = async () => {
    if (!getRevenueCatIosApiKey()) {
      Alert.alert('Not available', 'Subscriptions aren’t set up in this build. Install the App Store version to subscribe.');
      return;
    }
    setPaywallBusy(true);
    try {
      const ok = await presentPaywall();
      if (ok) setSubscribed(true);
    } finally {
      setPaywallBusy(false);
    }
  };

  const handleRestore = async () => {
    setRestoreBusy(true);
    try {
      const ok = await restorePurchasesWithUserFeedback();
      if (ok) setSubscribed(true);
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
          ? `Subscribe for ${LISTIO_PLUS_MONTHLY_USD_LABEL} or ${LISTIO_PLUS_ANNUAL_USD_LABEL} to unlock Listio+ features on this device. Price may vary by region.`
          : 'Checking your plan…';

  return (
    <Screen padded safeTop={false} safeBottom={false}>
      <SettingsPushedScreenHeader title="Plan" />
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
        <ListSection title="Current plan" {...settingsListSectionProps}>
          <Text style={[theme.typography.title3, { color: theme.textPrimary, marginBottom: theme.spacing.xs }]}>
            {planTitle}
          </Text>
          <Text style={[theme.typography.footnote, { color: theme.textSecondary, lineHeight: 20 }]}>
            {planBody}
          </Text>
        </ListSection>

        {Platform.OS === 'ios' && shouldEnforceIosSubscriptionGate() && subscribed === false ? (
          <>
            <ListSection title="Upgrade" {...settingsListSectionProps}>
              <Text
                style={[
                  theme.typography.footnote,
                  { color: theme.textSecondary, lineHeight: 20, marginBottom: theme.spacing.base },
                ]}
              >
                Listio+ monthly ({LISTIO_PLUS_MONTHLY_USD_LABEL}) or yearly ({LISTIO_PLUS_ANNUAL_USD_LABEL}). Cancel
                anytime in Settings.
              </Text>
              <PrimaryButton title="View plans" onPress={handleSubscribe} loading={paywallBusy} />
            </ListSection>
            <ListSection title="Already subscribed?" {...settingsRowListSectionProps}>
              <ListRow
                title="Restore purchases"
                subtitle="Get Listio+ back if you already subscribed"
                onPress={restoreBusy ? undefined : handleRestore}
                rightAccessory={
                  restoreBusy ? <ActivityIndicator size="small" color={theme.accent} /> : <Chevron />
                }
                showSeparator={false}
                fullWidthDivider
              />
            </ListSection>
          </>
        ) : null}

        <ListSection title="Included with Listio+" {...settingsRowListSectionProps}>
          <ListRow
            title="Use on all your devices"
            rightAccessory={
              <Text style={[theme.typography.footnote, { color: syncOn ? theme.accent : theme.textSecondary }]}>
                {syncOn ? 'With your account' : 'Sign in'}
              </Text>
            }
            showSeparator
            fullWidthDivider
          />
          <ListRow
            title="Smart add"
            subtitle="Describe your run, get a sorted list"
            showSeparator
            fullWidthDivider
          />
          <ListRow
            title="Recipe imports"
            subtitle="From a link or pasted text"
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
          <ListSection title="Billing" {...settingsRowListSectionProps}>
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
          <View style={[styles.legalFooter, { marginBottom: SETTINGS_SECTION_GAP }]}>
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
  legalFooter: {
    alignItems: 'center',
  },
});
