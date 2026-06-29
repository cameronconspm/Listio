import React, { useCallback, useMemo, useState } from 'react';
import { Text, ScrollView, Alert, Share, StyleSheet } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../design/ThemeContext';
import { useAuthUserId } from '../../context/AuthContext';
import { Screen } from '../../components/ui/Screen';
import { KeyboardSafeForm } from '../../components/ui/KeyboardSafeForm';
import { ListSection } from '../../components/ui/ListSection';
import { ListRow } from '../../components/ui/ListRow';
import { TextField } from '../../components/ui/TextField';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { QueryLoadErrorPanel } from '../../components/ui/QueryLoadErrorPanel';
import { SettingsPushedScreenHeader } from './SettingsPushedScreenHeader';
import { useSettingsScrollHandler } from '../../navigation/NavigationChromeScrollContext';
import { useSettingsScrollInsets } from './settingsScrollLayout';
import {
  settingsFieldStyle,
  settingsListSectionProps,
  settingsRowListSectionProps,
} from '../../design/settingsLayout';
import { spacing } from '../../design/spacing';
import {
  acceptHouseholdInvite,
  buildHouseholdInviteUrl,
  createHouseholdInvite,
  leaveSharedHousehold,
  removeHouseholdMember,
  revokeHouseholdInvite,
  updateHouseholdShareSettings,
  type HouseholdShareSettings,
} from '../../services/householdService';
import { SettingsToggleRow } from '../../components/settings/SettingsToggleRow';
import { useInvalidateHomeList } from '../../hooks/useInvalidateHomeList';
import { queryKeys } from '../../query/keys';
import { fetchShareListBundle, SHARE_LIST_STALE_MS } from '../../query/shareListBundle';
import {
  optimisticallyRemoveIncomingInvite,
  restoreShareListBundle,
  warmCachesAfterHouseholdJoin,
} from '../../query/householdJoinCache';
import { showMascotSuccess } from '../../utils/appToast';
import { householdMemberDisplayName } from '../../utils/householdMemberDisplay';

function inviteErrorMessage(code: string): string {
  switch (code) {
    case 'email_mismatch':
      return 'This invite was sent to a different email address.';
    case 'household_full':
      return 'This list already has the maximum number of members.';
    case 'invalid_or_expired':
      return 'This invite is invalid or has expired.';
    case 'no_email_in_jwt':
      return 'Your account needs a verified email to accept an invite.';
    default:
      return 'Could not accept invite. Try again.';
  }
}

export function ShareListScreen() {
  const theme = useTheme();
  const userId = useAuthUserId();
  const onScroll = useSettingsScrollHandler();
  const scrollInsets = useSettingsScrollInsets();
  const invalidateHomeList = useInvalidateHomeList();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [acceptBusy, setAcceptBusy] = useState<string | null>(null);

  const shareQueryKey =
    typeof userId === 'string' && userId.length > 0 ? queryKeys.shareList(userId) : null;

  const shareQuery = useQuery({
    queryKey: shareQueryKey ?? queryKeys.shareList('pending'),
    queryFn: fetchShareListBundle,
    enabled: shareQueryKey != null,
    staleTime: SHARE_LIST_STALE_MS,
  });

  const members = useMemo(
    () => shareQuery.data?.members ?? [],
    [shareQuery.data?.members]
  );
  const shareSettings = shareQuery.data?.shareSettings ?? null;
  const isOwner = shareQuery.data?.isOwner ?? false;
  const isSharedHousehold = shareQuery.data?.isSharedHousehold ?? false;
  const sentInvites = shareQuery.data?.sentInvites ?? [];
  const incomingInvites = shareQuery.data?.incomingInvites ?? [];
  const shareDataReady = shareQuery.data != null;
  const showEmptyMembers = shareDataReady && members.length === 0;

  const refreshShareList = useCallback(async () => {
    if (!shareQueryKey) return;
    await queryClient.invalidateQueries({ queryKey: shareQueryKey });
  }, [queryClient, shareQueryKey]);

  type SharedTabScope = 'meals' | 'recipes' | 'home' | 'all';

  const invalidateSharedTabs = useCallback(
    (scope: SharedTabScope = 'all') => {
      if (!userId) return;
      if (scope === 'meals' || scope === 'all') {
        void queryClient.invalidateQueries({ queryKey: queryKeys.meals(userId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.mealsRangeRoot(userId) });
      }
      if (scope === 'recipes' || scope === 'all') {
        void queryClient.invalidateQueries({ queryKey: queryKeys.recipesScreenRoot(userId) });
      }
      if (scope === 'home' || scope === 'all') {
        invalidateHomeList();
      }
    },
    [invalidateHomeList, queryClient, userId]
  );

  const memberLabels = useMemo(
    () =>
      members.map((m) => ({
        ...m,
        title: householdMemberDisplayName(m),
        subtitle: m.role === 'owner' ? 'List owner' : 'Shared access',
      })),
    [members]
  );

  const handleInvite = async () => {
    setInviteBusy(true);
    try {
      const invite = await createHouseholdInvite(inviteEmail);
      setInviteEmail('');
      await refreshShareList();
      const url = buildHouseholdInviteUrl(invite.token);
      await Share.share({
        message: `Join my Listio grocery list: ${url}`,
        url,
      });
    } catch (e) {
      Alert.alert('Could not send invite', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setInviteBusy(false);
    }
  };

  const handleShareToggle = useCallback(
    async (key: 'shareMeals' | 'shareRecipes', value: boolean) => {
      if (!shareQueryKey || !shareSettings) return;

      const previous = shareSettings;
      const optimistic: HouseholdShareSettings = { ...shareSettings, [key]: value };

      queryClient.setQueryData(shareQueryKey, (current) =>
        current ? { ...current, shareSettings: optimistic } : current
      );

      try {
        await updateHouseholdShareSettings({ [key]: value }, { currentSettings: previous });
        void invalidateSharedTabs(key === 'shareMeals' ? 'meals' : 'recipes');
      } catch (e) {
        queryClient.setQueryData(shareQueryKey, (current) =>
          current ? { ...current, shareSettings: previous } : current
        );
        Alert.alert('Could not update sharing', e instanceof Error ? e.message : 'Unknown error');
      }
    },
    [shareQueryKey, shareSettings, queryClient, invalidateSharedTabs]
  );

  const handleRemoveMember = (memberUserId: string) => {
    Alert.alert('Remove member?', 'They will lose access to this shared list.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await removeHouseholdMember(memberUserId);
              invalidateSharedTabs('all');
              await refreshShareList();
            } catch (e) {
              Alert.alert('Could not remove member', e instanceof Error ? e.message : 'Unknown error');
            }
          })();
        },
      },
    ]);
  };

  const handleLeaveSharedList = () => {
    Alert.alert(
      'Leave shared list?',
      'You will return to your personal list. The owner keeps their copy.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await leaveSharedHousehold();
                invalidateSharedTabs('all');
                await refreshShareList();
                Alert.alert('Left shared list', 'You are back on your personal list.');
              } catch (e) {
                Alert.alert('Could not leave', e instanceof Error ? e.message : 'Unknown error');
              }
            })();
          },
        },
      ]
    );
  };

  const handleAccept = useCallback(
    async (token: string) => {
      if (typeof userId !== 'string' || !userId) return;

      const shareSnapshot = optimisticallyRemoveIncomingInvite(queryClient, userId, token);
      setAcceptBusy(token);

      try {
        const result = await acceptHouseholdInvite(token);
        if (!result.ok) {
          restoreShareListBundle(queryClient, userId, shareSnapshot);
          Alert.alert('Invite not accepted', inviteErrorMessage(result.error));
          return;
        }

        invalidateHomeList();
        void invalidateSharedTabs();
        void warmCachesAfterHouseholdJoin(userId, queryClient);
        showMascotSuccess('List shared', 'You now shop from the same list.');
      } catch (e) {
        restoreShareListBundle(queryClient, userId, shareSnapshot);
        Alert.alert('Could not accept invite', e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setAcceptBusy(null);
      }
    },
    [userId, queryClient, invalidateHomeList, invalidateSharedTabs]
  );

  const handleRevoke = (inviteId: string) => {
    Alert.alert('Revoke invite?', 'They will no longer be able to use this link.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await revokeHouseholdInvite(inviteId);
              await refreshShareList();
            } catch (e) {
              Alert.alert('Could not revoke', e instanceof Error ? e.message : 'Unknown error');
            }
          })();
        },
      },
    ]);
  };

  const loadError =
    shareQuery.isError && !shareDataReady
      ? shareQuery.error instanceof Error
        ? shareQuery.error.message
        : 'Could not load sharing settings.'
      : null;

  return (
    <Screen padded safeTop={false} safeBottom={false}>
      <SettingsPushedScreenHeader title="Share list" />
      <KeyboardSafeForm style={styles.flex}>
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
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {loadError ? (
            <QueryLoadErrorPanel
              message={loadError}
              onRetry={() => void shareQuery.refetch()}
            />
          ) : (
            <>
              <ListSection title="About sharing" {...settingsListSectionProps}>
                <Text style={[theme.typography.body, { color: theme.textSecondary, lineHeight: 22 }]}>
                  Invite one person to collaborate. The grocery list is always shared; you choose whether meals and
                  recipes are included.
                </Text>
              </ListSection>

              {isOwner && shareSettings ? (
                <ListSection title="What to share" {...settingsRowListSectionProps}>
                  <SettingsToggleRow
                    title="Grocery list"
                    subtitle="Always shared when someone joins"
                    value
                    onValueChange={() => undefined}
                    disabled
                  />
                  <SettingsToggleRow
                    title="Meals"
                    subtitle="Meal plan and planned slots"
                    value={shareSettings.shareMeals}
                    onValueChange={(value) => void handleShareToggle('shareMeals', value)}
                  />
                  <SettingsToggleRow
                    title="Recipes"
                    subtitle="Saved recipes in the Recipes tab"
                    value={shareSettings.shareRecipes}
                    onValueChange={(value) => void handleShareToggle('shareRecipes', value)}
                  />
                </ListSection>
              ) : null}

              {incomingInvites.length > 0 ? (
                <ListSection title="Invites for you" {...settingsRowListSectionProps}>
                  {incomingInvites.map((inv, index) => (
                    <ListRow
                      key={inv.id}
                      title="List invite"
                      subtitle={inv.invitee_email}
                      rightAccessory={
                        <PrimaryButton
                          title={acceptBusy === inv.token ? '…' : 'Accept'}
                          onPress={() => void handleAccept(inv.token)}
                          disabled={acceptBusy === inv.token}
                          size="compact"
                        />
                      }
                      showSeparator={index < incomingInvites.length - 1}
                      fullWidthDivider
                    />
                  ))}
                </ListSection>
              ) : null}

              <ListSection title="People on this list" {...settingsRowListSectionProps}>
                {showEmptyMembers ? (
                  <EmptyState
                    icon="people-outline"
                    mascot="hero"
                    title="Just you for now"
                    message="Send an invite to share your list."
                    glass={false}
                  />
                ) : memberLabels.length > 0 ? (
                  memberLabels.map((m, index) => (
                    <ListRow
                      key={m.user_id}
                      title={m.title}
                      subtitle={m.subtitle}
                      rightAccessory={
                        isOwner && m.user_id !== userId && m.role === 'member' ? (
                          <Button
                            title="Remove"
                            variant="secondary"
                            onPress={() => handleRemoveMember(m.user_id)}
                            style={{ minHeight: 36, paddingHorizontal: theme.spacing.sm }}
                          />
                        ) : undefined
                      }
                      showSeparator={index < memberLabels.length - 1}
                      fullWidthDivider
                    />
                  ))
                ) : null}
              </ListSection>

              <ListSection title="Invite someone" {...settingsListSectionProps}>
                <TextField
                  label="Email"
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                  placeholder="partner@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  containerStyle={settingsFieldStyle}
                />
                <PrimaryButton
                  title="Send invite"
                  onPress={() => void handleInvite()}
                  loading={inviteBusy}
                  disabled={!inviteEmail.trim() || members.length >= 2}
                />
                {members.length >= 2 ? (
                  <Text style={[theme.typography.caption1, styles.hint, { color: theme.textSecondary }]}>
                    Your list already has two members. Remove a member before inviting someone new.
                  </Text>
                ) : null}
              </ListSection>

              {sentInvites.length > 0 ? (
                <ListSection title="Pending invites" {...settingsRowListSectionProps}>
                  {sentInvites.map((inv, index) => (
                    <ListRow
                      key={inv.id}
                      title={inv.invitee_email}
                      subtitle="Waiting to accept · tap to revoke"
                      onPress={() => handleRevoke(inv.id)}
                      showSeparator={index < sentInvites.length - 1}
                      fullWidthDivider
                    />
                  ))}
                </ListSection>
              ) : null}

              {!isOwner && isSharedHousehold ? (
                <ListSection {...settingsListSectionProps}>
                  <PrimaryButton
                    title="Leave shared list"
                    onPress={handleLeaveSharedList}
                    flat
                  />
                </ListSection>
              ) : null}
            </>
          )}
        </ScrollView>
      </KeyboardSafeForm>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flex: 1 },
  content: {},
  hint: { marginTop: spacing.sm, lineHeight: 18 },
});
