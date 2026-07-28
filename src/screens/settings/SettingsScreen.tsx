import React, { useState, useCallback, useMemo } from 'react';
import { StyleSheet, ScrollView, ActivityIndicator, Alert, Linking, Modal, Platform, View, Text } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { SettingsStackParamList } from '../../navigation/types';
import { useTheme } from '../../design/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { tabRootScrollPaddingTop } from '../../design/layout';
import { Screen } from '../../components/ui/Screen';
import { EmptyState } from '../../components/ui/EmptyState';
import { SettingsHubHeader } from '../../components/settings/SettingsHubHeader';
import { useSettingsScrollHandler } from '../../navigation/NavigationChromeScrollContext';
import { useTabRootScrollInsets } from './settingsScrollLayout';
import { ListSection } from '../../components/ui/ListSection';
import { ListRow } from '../../components/ui/ListRow';
import { AppConfirmationDialog } from '../../components/ui/AppConfirmationDialog';
import { supabase, getUserId, isSyncEnabled } from '../../services/supabaseClient';
import { deleteAllAppDataPreservingAccount } from '../../services/deleteUserAppDataService';
import { useInvalidateHomeList } from '../../hooks/useInvalidateHomeList';
import { leaveSettingsHub } from '../../navigation/settingsHubNavigation';
import { queryKeys } from '../../query/keys';
import { prefetchShareList } from '../../query/shareListBundle';
import { clearPersistedQueryCache } from '../../query/reactQueryPersistence';
import {
  fetchPremiumEntitlementActive,
  presentAppleSubscriptionManagement,
  shouldEnforceIosSubscriptionGate,
} from '../../services/purchasesService';
import { useContextualPaywall } from '../../context/ContextualPaywallContext';
import type { ContextualPaywallReason } from '../../context/contextualPaywallReasons';
import { restorePurchasesWithUserFeedback } from '../../services/restorePurchasesFlow';
import { shouldShowQaSettingsTools } from '../../constants/qaSettingsTools';
import { WelcomeIntroScreen } from '../auth/WelcomeIntroScreen';
import { getPerfSnapshot, resetPerfSnapshot } from '../../utils/perf';
import { formatBuildHealthAlert, getBuildHealthSnapshot } from '../../utils/buildHealth';
import { useAppReview } from '../../context/AppReviewContext';
import { resetAppReviewState } from '../../services/appReviewService';
import {
  SETTINGS_HUB_TOP_GAP,
  settingsRowListSectionProps,
} from '../../design/settingsLayout';
import { SUPPORT_HELP_CENTER_URL } from '../../constants/legalUrls';

const FEEDBACK_EMAIL = 'feedback@thelistioapp.com';

const Chevron = () => {
  const theme = useTheme();
  return <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />;
};

export function SettingsScreen() {
  const theme = useTheme();
  const { userId, userEmail, isAuthReady } = useAuth();
  const queryClient = useQueryClient();
  const invalidateHomeList = useInvalidateHomeList();
  const onScroll = useSettingsScrollHandler();
  const scrollInsets = useTabRootScrollInsets();
  const navigation = useNavigation<NativeStackNavigationProp<SettingsStackParamList>>();
  const insets = useSafeAreaInsets();
  const scrollPaddingTop = tabRootScrollPaddingTop(insets.top, theme.spacing);
  const [searchQuery, setSearchQuery] = useState('');
  const [perfDiag, setPerfDiag] = useState<string | null>(null);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [showDeleteDataConfirm, setShowDeleteDataConfirm] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [paywallBusy, setPaywallBusy] = useState(false);
  const [introPreviewVisible, setIntroPreviewVisible] = useState(false);
  const [subscribed, setSubscribed] = useState<boolean | null>(null);

  const showQaSettingsTools = shouldShowQaSettingsTools(userEmail);
  const showSubscriptionPlanRow =
    Platform.OS === 'ios' && shouldEnforceIosSubscriptionGate();
  const { previewReviewPrompt } = useAppReview();
  const { presentPaywall, presentPaywallPreview } = useContextualPaywall();

  useFocusEffect(
    useCallback(() => {
      if (typeof userId === 'string' && userId.length > 0) {
        prefetchShareList(userId, queryClient);
      }
    }, [userId, queryClient])
  );

  useFocusEffect(
    useCallback(() => {
      if (!showSubscriptionPlanRow) {
        setSubscribed(null);
        return;
      }
      let cancelled = false;
      void fetchPremiumEntitlementActive().then((ok) => {
        if (!cancelled) setSubscribed(ok);
      });
      return () => {
        cancelled = true;
      };
    }, [showSubscriptionPlanRow])
  );

  const headerChrome = (
    <SettingsHubHeader searchQuery={searchQuery} onSearchChange={setSearchQuery} />
  );

  const profileSubtitle = useMemo(() => {
    if (!isSyncEnabled()) return 'Sign in to use your account';
    if (userEmail) return userEmail;
    if (!isAuthReady) return undefined;
    if (userId) return undefined;
    return 'Sign in to use your account';
  }, [userEmail, isAuthReady, userId]);

  const planHubSubtitle = useMemo(() => {
    if (!showSubscriptionPlanRow) return undefined;
    if (subscribed === true) return 'Listio+ active · Unlimited items, meals, and recipes';
    if (subscribed === false) return 'View plans and pricing';
    return 'Checking your plan…';
  }, [showSubscriptionPlanRow, subscribed]);

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
        'share list',
        'shared',
        'household',
        'invite',
      ]),
      shareList: match('Account', 'Share list', 'Invite someone to shop from the same list', [
        'shared',
        'household',
        'partner',
        'family',
        'invite',
      ]),
      subscriptionPlan:
        showSubscriptionPlanRow &&
        match('Subscription', 'Listio+', planHubSubtitle, [
          'plan',
          'subscribe',
          'pricing',
          'premium',
          'listio',
          'upgrade',
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
      demoReviewPrompt:
        showQaSettingsTools &&
        match('Demo', 'Preview App Store review', 'Apple’s native in-app rating prompt', [
          'review',
          'rating',
          'app store',
          'stars',
        ]),
      demoDeleteData:
        showQaSettingsTools &&
        match(
          'Demo',
          'Delete data',
          isSyncEnabled()
            ? 'Remove your lists, meals, and recipes. Your account stays.'
            : 'Remove all lists, meals, and recipes stored on this device',
          ['delete', 'remove', 'wipe', 'erase']
        ),
      demoCustomPaywall:
        showQaSettingsTools &&
        match('Demo', 'Preview Listio+ paywall', 'Custom paywall mockup with free-trial CTA', [
          'paywall',
          'subscribe',
          'trial',
          'listio',
          'mockup',
        ]),
      buildHealth:
        showQaSettingsTools &&
        match('Demo', 'Build health', 'Supabase project, RevenueCat, and Sentry status', [
          'debug',
          'health',
          'sentry',
          'supabase',
          'revenuecat',
        ]),
      session: isSyncEnabled() && match('Session', 'Log out', '', ['sign out', 'signout', 'logout', 'session']),
    };
  }, [searchQuery, profileSubtitle, showQaSettingsTools, showSubscriptionPlanRow, planHubSubtitle]);

  const hasHubSearchMatches = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return true;
    const v = hubVisibility;
    return (
      v.account ||
      v.subscriptionPlan ||
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
      v.demoReviewPrompt ||
      v.demoDeleteData ||
      v.buildHealth ||
      v.session
    );
  }, [searchQuery, hubVisibility]);

  const handleShowBuildHealth = useCallback(() => {
    Alert.alert('Build health', formatBuildHealthAlert(getBuildHealthSnapshot()));
  }, []);

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

  const handleLogout = async () => {
    if (!isSyncEnabled()) return;
    await supabase.auth.signOut();
    await clearPersistedQueryCache();
    queryClient.clear();
    const { resetAccountBootstrapSession } = await import('../../context/accountBootstrapSession');
    resetAccountBootstrapSession();
  };

  const handleRestorePurchases = async () => {
    setRestoreBusy(true);
    try {
      await restorePurchasesWithUserFeedback();
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

  const handleShowPaywall = async (options?: {
    reason?: ContextualPaywallReason | null;
    preview?: boolean;
  }) => {
    if (options?.preview) {
      setPaywallBusy(true);
      try {
        await presentPaywallPreview(options.reason ?? 'smart_add');
      } catch (e) {
        Alert.alert('Could not preview paywall', e instanceof Error ? e.message : 'Please try again.');
      } finally {
        setPaywallBusy(false);
      }
      return;
    }

    setPaywallBusy(true);
    try {
      await presentPaywall(options?.reason ?? null, { feedbackOnSkip: true });
    } catch (e) {
      Alert.alert('Could not present paywall', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setPaywallBusy(false);
    }
  };

  const openPlanScreen = useCallback(() => {
    navigation.navigate('Plan');
  }, [navigation]);

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
    <Screen padded={false} safeTop={false} safeBottom={false}>
      <View style={styles.headerOverlay} pointerEvents="box-none">
        {headerChrome}
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: scrollPaddingTop + SETTINGS_HUB_TOP_GAP,
            paddingBottom: scrollInsets.paddingBottom,
            paddingHorizontal: theme.spacing.md,
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
              <ListSection title="Account" {...settingsRowListSectionProps}>
                <ListRow
                  title="Profile"
                  subtitle={profileSubtitle}
                  onPress={() => navigation.navigate('Profile')}
                  rightAccessory={<Chevron />}
                  showSeparator={hubVisibility.shareList}
                  fullWidthDivider
                />
                {hubVisibility.shareList ? (
                  <ListRow
                    title="Share list"
                    subtitle="Invite someone to shop from the same list"
                    onPress={() => navigation.navigate('ShareList')}
                    rightAccessory={<Chevron />}
                    showSeparator={false}
                    fullWidthDivider
                  />
                ) : null}
              </ListSection>
            ) : null}

            {Platform.OS === 'ios' &&
            (hubVisibility.subscriptionPlan ||
              hubVisibility.subscriptionRestore ||
              hubVisibility.subscriptionManage) ? (
              <ListSection title="Subscription" {...settingsRowListSectionProps}>
                {hubVisibility.subscriptionPlan ? (
                  <ListRow
                    title="Listio+"
                    subtitle={planHubSubtitle}
                    onPress={openPlanScreen}
                    rightAccessory={<Chevron />}
                    showSeparator={
                      hubVisibility.subscriptionRestore || hubVisibility.subscriptionManage
                    }
                    fullWidthDivider
                  />
                ) : null}
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
                {hubVisibility.subscriptionManage && subscribed === true ? (
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
              <ListSection title="Preferences" {...settingsRowListSectionProps}>
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
              <ListSection title="Support" {...settingsRowListSectionProps}>
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
              hubVisibility.demoReviewPrompt ||
              hubVisibility.demoDeleteData ||
              hubVisibility.demoCustomPaywall ||
              hubVisibility.buildHealth) ? (
              <ListSection title="Demo" {...settingsRowListSectionProps}>
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
                    onPress={paywallBusy ? undefined : () => void handleShowPaywall()}
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
                      hubVisibility.demoReviewPrompt ||
                      hubVisibility.demoDeleteData ||
                      hubVisibility.demoCustomPaywall
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
                    showSeparator={
                      hubVisibility.demoReplayIntro ||
                      hubVisibility.demoReviewPrompt ||
                      hubVisibility.demoDeleteData
                    }
                    fullWidthDivider
                  />
                ) : null}
                {hubVisibility.demoReplayIntro ? (
                  <ListRow
                    title="Replay intro"
                    subtitle="Preview the first-launch welcome animation"
                    onPress={() => setIntroPreviewVisible(true)}
                    rightAccessory={<Chevron />}
                    showSeparator={hubVisibility.demoReviewPrompt || hubVisibility.demoDeleteData}
                    fullWidthDivider
                  />
                ) : null}
                {hubVisibility.demoReviewPrompt ? (
                  <ListRow
                    title="Preview App Store review"
                    subtitle="Apple’s native prompt (tap) · reset eligibility counters (long-press)"
                    onPress={() => previewReviewPrompt()}
                    onLongPress={() => {
                      void resetAppReviewState().then(() => {
                        Alert.alert('Done', 'Review eligibility counters cleared on this device.');
                      });
                    }}
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
                        ? 'Remove your lists, meals, and recipes. Your account stays.'
                        : 'Remove all lists, meals, and recipes stored on this device'
                    }
                    onPress={handleDeleteDataPress}
                    showSeparator={hubVisibility.demoCustomPaywall || hubVisibility.buildHealth}
                    fullWidthDivider
                    titleStyle={{ color: theme.danger }}
                    subtitleStyle={{ color: theme.danger }}
                  />
                ) : null}
                {hubVisibility.demoCustomPaywall ? (
                  <ListRow
                    title="Preview Listio+ paywall"
                    subtitle="Custom paywall (7-day or 2-week trial)"
                    onPress={
                      paywallBusy
                        ? undefined
                        : () => void handleShowPaywall({ preview: true, reason: 'smart_add' })
                    }
                    rightAccessory={
                      paywallBusy ? (
                        <ActivityIndicator size="small" color={theme.accent} />
                      ) : (
                        <Chevron />
                      )
                    }
                    showSeparator={hubVisibility.buildHealth}
                    fullWidthDivider
                  />
                ) : null}
                {hubVisibility.buildHealth ? (
                  <ListRow
                    title="Build health"
                    subtitle={`Supabase: ${getBuildHealthSnapshot().supabaseProjectRef}`}
                    onPress={handleShowBuildHealth}
                    showSeparator
                    fullWidthDivider
                  />
                ) : null}
                {showQaSettingsTools ? (
                  <>
                    <ListRow
                      title="Show perf snapshot"
                      subtitle="Render counts and recent timing samples"
                      onPress={() => setPerfDiag(JSON.stringify(getPerfSnapshot(), null, 2))}
                      showSeparator
                      fullWidthDivider
                    />
                    <ListRow
                      title="Reset perf snapshot"
                      subtitle="Clear render counts and timing samples"
                      onPress={() => {
                        resetPerfSnapshot();
                        setPerfDiag(null);
                      }}
                      showSeparator={false}
                      fullWidthDivider
                    />
                    {perfDiag ? (
                      <Text
                        selectable
                        style={[
                          theme.typography.caption2,
                          {
                            color: theme.textSecondary,
                            paddingHorizontal: theme.spacing.md,
                            paddingBottom: theme.spacing.sm,
                          },
                        ]}
                      >
                        {perfDiag}
                      </Text>
                    ) : null}
                  </>
                ) : null}
              </ListSection>
            ) : null}

            {hubVisibility.session ? (
              <ListSection title="Session" {...settingsRowListSectionProps}>
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
            ? 'This removes your lists, planned meals, and recipes from your account. Your sign-in and profile stay.'
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
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  content: {},
});
