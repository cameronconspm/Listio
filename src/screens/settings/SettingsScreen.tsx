import React, { useState, useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import { StyleSheet, ScrollView, ActivityIndicator, Alert, Linking, Modal, Platform } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { SettingsStackParamList } from '../../navigation/types';
import { useTheme } from '../../design/ThemeContext';
import { tabScrollPaddingTopBelowHeader } from '../../design/layout';
import { Screen } from '../../components/ui/Screen';
import { EmptyState } from '../../components/ui/EmptyState';
import { SettingsHubHeader } from '../../components/settings/SettingsHubHeader';
import { useSettingsScrollHandler } from '../../navigation/NavigationChromeScrollContext';
import { useSettingsScrollInsets } from './settingsScrollLayout';
import { ListSection } from '../../components/ui/ListSection';
import { ListRow } from '../../components/ui/ListRow';
import { AppConfirmationDialog } from '../../components/ui/AppConfirmationDialog';
import { supabase, getUserId, isSyncEnabled } from '../../services/supabaseClient';
import { deleteAllAppDataPreservingAccount } from '../../services/deleteUserAppDataService';
import { useInvalidateHomeList } from '../../hooks/useInvalidateHomeList';
import { leaveSettingsHub } from '../../navigation/settingsHubNavigation';
import { queryKeys } from '../../query/keys';
import { clearPersistedQueryCache } from '../../query/reactQueryPersistence';
import {
  customerInfoHasPremium,
  getRevenueCatIosApiKey,
  isRevenueCatNativeLayerSkipped,
  presentPaywallForPurchase,
  presentAppleSubscriptionManagement,
  restorePurchases,
} from '../../services/purchasesService';
import { resolveAuthAccountEmail } from '../../constants/officialTestAccount';
import { shouldShowQaSettingsTools } from '../../constants/qaSettingsTools';
import { WelcomeIntroScreen } from '../auth/WelcomeIntroScreen';
import { getPerfSnapshot, resetPerfSnapshot } from '../../utils/perf';
import { spacing } from '../../design/spacing';
import { SUPPORT_HELP_CENTER_URL } from '../../constants/legalUrls';

const FEEDBACK_EMAIL = 'feedback@thelistioapp.com';

const Chevron = () => {
  const theme = useTheme();
  return <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />;
};

export function SettingsScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const invalidateHomeList = useInvalidateHomeList();
  const onScroll = useSettingsScrollHandler();
  const scrollInsets = useSettingsScrollInsets();
  const navigation = useNavigation<NativeStackNavigationProp<SettingsStackParamList>>();
  const headerHeight = useHeaderHeight();
  const scrollPaddingTop = tabScrollPaddingTopBelowHeader(headerHeight, theme.spacing);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [showDeleteDataConfirm, setShowDeleteDataConfirm] = useState(false);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [paywallBusy, setPaywallBusy] = useState(false);
  const [introPreviewVisible, setIntroPreviewVisible] = useState(false);

  const showQaSettingsTools = shouldShowQaSettingsTools(accountEmail);

  useLayoutEffect(() => {
    navigation.setOptions({
      header: () => (
        <SettingsHubHeader searchQuery={searchQuery} onSearchChange={setSearchQuery} />
      ),
    });
  }, [navigation, searchQuery]);

  const profileSubtitle =
    !isSyncEnabled()
      ? 'Not connected to cloud sync'
      : accountEmail
        ? accountEmail
        : 'Loading…';

  const hubVisibility = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const match = (sectionTitle: string, rowTitle: string, rowSubtitle?: string, extra: string[] = []) => {
      if (!q) return true;
      if (sectionTitle.toLowerCase().includes(q)) return true;
      const blob = [rowTitle, rowSubtitle ?? '', ...extra].join(' ').toLowerCase();
      return blob.includes(q);
    };

    return {
      account: match('Account', 'Profile', profileSubtitle, [
        'password',
        'email',
        'name',
        'sign in',
        'change password',
      ]),
      subscriptionRestore:
        Platform.OS === 'ios' &&
        match('Subscription', 'Restore purchases', 'Get Listio+ back if you already subscribed', [
          'listio',
          'purchase',
          'restore',
        ]),
      subscriptionManage:
        Platform.OS === 'ios' &&
        match('Subscription', 'Manage subscription', 'Cancel, change plan, or update payment', [
          'cancel',
          'billing',
          'payment',
          'plan',
        ]),
      notifications: match(
        'Preferences',
        'Notifications',
        'Reminders for meals, your list, and product updates',
        ['reminder', 'push', 'meal', 'updates']
      ),
      theme: match('Preferences', 'Theme', 'Choose light, dark, or system appearance', [
        'appearance',
        'dark',
        'light',
        'system',
        'mode',
      ]),
      replayOnboarding:
        showQaSettingsTools &&
        match('Demo', 'Replay onboarding', 'See the welcome steps again', [
          'onboarding',
          'welcome',
          'intro',
          'setup',
        ]),
      help: match('Support', 'Help center', 'Tips, how-tos, and common questions', [
        'help',
        'faq',
        'guide',
        'thelistioapp',
      ]),
      feedback: match('Support', 'Send feedback', FEEDBACK_EMAIL, ['feedback', 'email', 'contact']),
      privacy: match(
        'Support',
        'Privacy & terms',
        'Privacy policy, terms, and delete your account',
        ['privacy', 'terms', 'delete', 'legal', 'policy', 'account']
      ),
      demoLoad:
        showQaSettingsTools &&
        match('Demo', 'Load demo data', 'Fill the app with sample lists, recipes, and meals', [
          'demo',
          'sample',
          'example',
        ]),
      demoPaywall:
        showQaSettingsTools &&
        match('Demo', 'Show paywall', 'See subscription plans and pricing', [
          'paywall',
          'subscribe',
          'pricing',
          'listio',
        ]),
      demoReplayIntro:
        showQaSettingsTools &&
        match(
          'Demo',
          'Replay intro',
          'Preview the first-launch welcome animation',
          ['intro', 'welcome', 'first launch', 'preview', 'animation']
        ),
      demoDeleteData:
        showQaSettingsTools &&
        match(
          'Demo',
          'Delete data',
          isSyncEnabled()
            ? 'Remove lists, meals, and recipes from the cloud. Your account stays.'
            : 'Remove all lists, meals, and recipes stored on this device',
          ['delete', 'remove', 'wipe', 'erase']
        ),
      session: isSyncEnabled() && match('Session', 'Log out', '', ['sign out', 'signout', 'logout', 'session']),
    };
  }, [searchQuery, profileSubtitle, showQaSettingsTools]);

  const hasHubSearchMatches = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return true;
    const v = hubVisibility;
    return (
      v.account ||
      v.subscriptionRestore ||
      v.subscriptionManage ||
      v.notifications ||
      v.theme ||
      v.help ||
      v.feedback ||
      v.privacy ||
      v.demoLoad ||
      v.demoPaywall ||
      v.replayOnboarding ||
      v.demoReplayIntro ||
      v.demoDeleteData ||
      v.session
    );
  }, [searchQuery, hubVisibility]);

  const openHelpCenter = useCallback(() => {
    void Linking.openURL(SUPPORT_HELP_CENTER_URL).catch(() => {
      Alert.alert(
        'Could not open link',
        'Open thelistioapp.com/help in your browser for guides and answers.',
      );
    });
  }, []);

  const openSendFeedback = useCallback(() => {
    const url = `mailto:${FEEDBACK_EMAIL}`;
    void Linking.openURL(url).catch(() => {
      Alert.alert('Email not available', `Send a message to ${FEEDBACK_EMAIL} from your email app.`);
    });
  }, []);

  const loadAccountEmail = useCallback(async () => {
    if (!isSyncEnabled()) {
      setAccountEmail(null);
      return;
    }
    const { data } = await supabase.auth.getUser();
    setAccountEmail(resolveAuthAccountEmail(data.user));
  }, []);

  useEffect(() => {
    void loadAccountEmail();
  }, [loadAccountEmail]);

  useEffect(() => {
    if (!isSyncEnabled()) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccountEmail(resolveAuthAccountEmail(session?.user));
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    if (!isSyncEnabled()) return;
    await supabase.auth.signOut();
    await clearPersistedQueryCache();
    queryClient.clear();
  };

  const handleRestorePurchases = async () => {
    if (Platform.OS !== 'ios') return;
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
        'RevenueCat is not configured in this build. Use a development or production build with EXPO_PUBLIC_REVENUECAT_IOS_API_KEY set.'
      );
      return;
    }
    setRestoreBusy(true);
    try {
      const info = await restorePurchases();
      if (customerInfoHasPremium(info)) {
        Alert.alert('Restored', 'Your subscription is active.');
      } else {
        Alert.alert(
          'No subscription found',
          'We couldn’t find an active subscription for this account.'
        );
      }
    } catch (e) {
      Alert.alert('Restore failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setRestoreBusy(false);
    }
  };

  const openManageSubscriptions = useCallback(() => {
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
  }, []);

  const handleShowPaywall = async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert('Not available', 'The paywall is currently iOS-only.');
      return;
    }
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
        'RevenueCat is not configured in this build. Use a build with EXPO_PUBLIC_REVENUECAT_IOS_API_KEY set.'
      );
      return;
    }

    setPaywallBusy(true);
    try {
      await presentPaywallForPurchase();
    } catch (e) {
      Alert.alert('Could not present paywall', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setPaywallBusy(false);
    }
  };

  const handleLoadDemo = async () => {
    const userId = await getUserId();
    if (!userId) return;
    setLoadingDemo(true);
    try {
      const { loadDemoData } = await import('../../services/demoDataService');
      await loadDemoData(userId);
      await queryClient.invalidateQueries({ queryKey: queryKeys.root });
      await invalidateHomeList();
      leaveSettingsHub(navigation);
    } catch (e) {
      setDemoError(
        e instanceof Error ? e.message : 'Something went wrong. Check your connection and try again.'
      );
    } finally {
      setLoadingDemo(false);
    }
  };

  const handleDeleteDataPress = () => setShowDeleteDataConfirm(true);

  const handleConfirmDeleteData = async () => {
    setShowDeleteDataConfirm(false);
    try {
      await deleteAllAppDataPreservingAccount();
      const uid = await getUserId();
      if (uid) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.root });
      }
      leaveSettingsHub(navigation);
    } catch (e) {
      Alert.alert(
        'Could not delete data',
        e instanceof Error ? e.message : 'Please try again.'
      );
    }
  };

  return (
    <Screen padded safeTop={false} safeBottom={false}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: scrollPaddingTop,
            paddingBottom: scrollInsets.paddingBottom,
          },
          !hasHubSearchMatches && { flexGrow: 1 },
        ]}
        onScroll={onScroll}
        scrollEventThrottle={scrollInsets.scrollEventThrottle}
        contentInsetAdjustmentBehavior={scrollInsets.contentInsetBehavior}
        showsVerticalScrollIndicator={false}
      >
        {!hasHubSearchMatches ? (
          <EmptyState
            icon="search-outline"
            title="No matches"
            message="Try another word, or search for a section name (like Account or Support)."
            glass={false}
          />
        ) : (
          <>
            {/* Account */}
            {hubVisibility.account ? (
              <ListSection title="Account" titleVariant="small" glass={false} style={styles.section}>
                <ListRow
                  title="Profile"
                  subtitle={profileSubtitle}
                  onPress={() => navigation.navigate('Profile')}
                  rightAccessory={<Chevron />}
                  showSeparator={false}
                  fullWidthDivider
                />
              </ListSection>
            ) : null}

            {Platform.OS === 'ios' &&
            (hubVisibility.subscriptionRestore || hubVisibility.subscriptionManage) ? (
              <ListSection title="Subscription" titleVariant="small" glass={false} style={styles.section}>
                {hubVisibility.subscriptionRestore ? (
                  <ListRow
                    title="Restore purchases"
                    subtitle="Get Listio+ back if you already subscribed"
                    onPress={restoreBusy ? undefined : handleRestorePurchases}
                    rightAccessory={
                      restoreBusy ? <ActivityIndicator size="small" color={theme.accent} /> : <Chevron />
                    }
                    showSeparator={hubVisibility.subscriptionManage}
                    fullWidthDivider
                  />
                ) : null}
                {hubVisibility.subscriptionManage ? (
                  <ListRow
                    title="Manage subscription"
                    subtitle="Cancel, change plan, or update payment"
                    onPress={openManageSubscriptions}
                    rightAccessory={<Chevron />}
                    showSeparator={false}
                    fullWidthDivider
                  />
                ) : null}
              </ListSection>
            ) : null}

            {hubVisibility.notifications || hubVisibility.theme ? (
              <ListSection title="Preferences" titleVariant="small" glass={false} style={styles.section}>
                {hubVisibility.notifications ? (
                  <ListRow
                    title="Notifications"
                    subtitle="Reminders for meals, your list, and product updates"
                    onPress={() => navigation.navigate('Notifications')}
                    rightAccessory={<Chevron />}
                    showSeparator={hubVisibility.theme}
                    fullWidthDivider
                  />
                ) : null}
                {hubVisibility.theme ? (
                  <ListRow
                    title="Theme"
                    subtitle="Choose light, dark, or system appearance"
                    onPress={() => navigation.navigate('ThemePreferences')}
                    rightAccessory={<Chevron />}
                    showSeparator={false}
                    fullWidthDivider
                  />
                ) : null}
              </ListSection>
            ) : null}

            {hubVisibility.help || hubVisibility.feedback || hubVisibility.privacy ? (
              <ListSection title="Support" titleVariant="small" glass={false} style={styles.section}>
                {hubVisibility.help ? (
                  <ListRow
                    title="Help center"
                    subtitle="Tips, how-tos, and common questions"
                    onPress={openHelpCenter}
                    rightAccessory={<Chevron />}
                    showSeparator={hubVisibility.feedback || hubVisibility.privacy}
                    fullWidthDivider
                  />
                ) : null}
                {hubVisibility.feedback ? (
                  <ListRow
                    title="Send feedback"
                    subtitle={FEEDBACK_EMAIL}
                    onPress={openSendFeedback}
                    rightAccessory={<Chevron />}
                    showSeparator={hubVisibility.privacy}
                    fullWidthDivider
                  />
                ) : null}
                {hubVisibility.privacy ? (
                  <ListRow
                    title="Privacy & terms"
                    subtitle="Privacy policy, terms, and delete your account"
                    onPress={() => navigation.navigate('PrivacyTerms')}
                    rightAccessory={<Chevron />}
                    showSeparator={false}
                    fullWidthDivider
                  />
                ) : null}
              </ListSection>
            ) : null}

            {showQaSettingsTools &&
            (hubVisibility.demoLoad ||
              hubVisibility.demoPaywall ||
              hubVisibility.replayOnboarding ||
              hubVisibility.demoReplayIntro ||
              hubVisibility.demoDeleteData) ? (
              <ListSection title="Demo" titleVariant="small" glass={false} style={styles.section}>
                {hubVisibility.demoLoad ? (
                  <ListRow
                    title="Load demo data"
                    subtitle="Fill the app with sample lists, recipes, and meals"
                    onPress={loadingDemo ? undefined : handleLoadDemo}
                    rightAccessory={
                      loadingDemo ? (
                        <ActivityIndicator size="small" color={theme.accent} />
                      ) : (
                        <Chevron />
                      )
                    }
                    showSeparator={
                      hubVisibility.demoPaywall ||
                      hubVisibility.replayOnboarding ||
                      hubVisibility.demoReplayIntro ||
                      hubVisibility.demoDeleteData
                    }
                    fullWidthDivider
                  />
                ) : null}
                {hubVisibility.demoPaywall ? (
                  <ListRow
                    title="Show paywall"
                    subtitle="See subscription plans and pricing"
                    onPress={paywallBusy ? undefined : handleShowPaywall}
                    rightAccessory={
                      paywallBusy ? (
                        <ActivityIndicator size="small" color={theme.accent} />
                      ) : (
                        <Chevron />
                      )
                    }
                    showSeparator={
                      hubVisibility.replayOnboarding ||
                      hubVisibility.demoReplayIntro ||
                      hubVisibility.demoDeleteData
                    }
                    fullWidthDivider
                  />
                ) : null}
                {hubVisibility.replayOnboarding ? (
                  <ListRow
                    title="Replay onboarding"
                    subtitle="See the welcome steps again"
                    onPress={() => navigation.navigate('Onboarding')}
                    rightAccessory={<Chevron />}
                    showSeparator={hubVisibility.demoReplayIntro || hubVisibility.demoDeleteData}
                    fullWidthDivider
                  />
                ) : null}
                {hubVisibility.demoReplayIntro ? (
                  <ListRow
                    title="Replay intro"
                    subtitle="Preview the first-launch welcome animation"
                    onPress={() => setIntroPreviewVisible(true)}
                    rightAccessory={<Chevron />}
                    showSeparator={hubVisibility.demoDeleteData}
                    fullWidthDivider
                  />
                ) : null}
                {hubVisibility.demoDeleteData ? (
                  <ListRow
                    title="Delete data"
                    subtitle={
                      isSyncEnabled()
                        ? 'Remove lists, meals, and recipes from the cloud. Your account stays.'
                        : 'Remove all lists, meals, and recipes stored on this device'
                    }
                    onPress={handleDeleteDataPress}
                    showSeparator={__DEV__}
                    fullWidthDivider
                    titleStyle={{ color: theme.danger }}
                    subtitleStyle={{ color: theme.danger }}
                  />
                ) : null}
                {__DEV__ ? (
                  <ListRow
                    title="Dump perf snapshot"
                    subtitle="Log render counts and timing samples to the console"
                    onPress={() => {
                      const snap = getPerfSnapshot();
                      console.log('[perf] snapshot', JSON.stringify(snap, null, 2));
                    }}
                    rightAccessory={<Chevron />}
                    showSeparator
                    fullWidthDivider
                  />
                ) : null}
                {__DEV__ ? (
                  <ListRow
                    title="Reset perf snapshot"
                    subtitle="Clear render counts and timing samples"
                    onPress={() => resetPerfSnapshot()}
                    showSeparator={false}
                    fullWidthDivider
                  />
                ) : null}
              </ListSection>
            ) : null}

            {hubVisibility.session ? (
              <ListSection title="Session" titleVariant="small" glass={false} dense style={styles.section}>
                <ListRow
                  title="Log out"
                  onPress={handleLogout}
                  showSeparator={false}
                  fullWidthDivider
                  compact
                  titleStyle={{ color: theme.danger }}
                />
              </ListSection>
            ) : null}
          </>
        )}
      </ScrollView>

      <AppConfirmationDialog
        visible={!!demoError}
        onClose={() => setDemoError(null)}
        title="Could not load demo data"
        message={demoError ?? undefined}
        buttons={[{ label: 'OK', onPress: () => {} }]}
      />
      <AppConfirmationDialog
        visible={showDeleteDataConfirm}
        onClose={() => setShowDeleteDataConfirm(false)}
        title="Delete all data?"
        message={
          isSyncEnabled()
            ? 'This removes your lists, planned meals, and recipes from the cloud. Your sign-in and profile stay.'
            : 'This permanently removes all lists, meals, and recipes stored on this device.'
        }
        buttons={[
          { label: 'Cancel', onPress: () => {}, cancel: true },
          { label: 'Delete', onPress: handleConfirmDeleteData, destructive: true },
        ]}
      />

      {/*
        QA-only demo of the pre-auth welcome intro. Rendered in preview mode so
        it doesn't persist the "seen" flag or touch auth navigation — both CTAs
        and the ✕ simply dismiss this modal.
      */}
      <Modal
        visible={introPreviewVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setIntroPreviewVisible(false)}
      >
        <WelcomeIntroScreen preview onPreviewDismiss={() => setIntroPreviewVisible(false)} />
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {},
  section: { marginBottom: spacing.lg },
});
