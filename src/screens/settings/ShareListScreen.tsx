import React, { useCallback, useMemo, useState } from 'react';
import { Text, ScrollView, Alert, Share, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../design/ThemeContext';
import { useAuthUserId } from '../../context/AuthContext';
import { Screen } from '../../components/ui/Screen';
import { KeyboardSafeForm } from '../../components/ui/KeyboardSafeForm';
import { ListSection } from '../../components/ui/ListSection';
import { ListRow } from '../../components/ui/ListRow';
import { TextField } from '../../components/ui/TextField';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
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
  fetchHouseholdMembers,
  fetchPendingInvitesForEmail,
  fetchPendingInvitesSent,
  revokeHouseholdInvite,
  type HouseholdInviteRow,
  type HouseholdMemberRow,
} from '../../services/householdService';
import { resolveAuthAccountEmail } from '../../constants/officialTestAccount';
import { supabase } from '../../services/supabaseClient';
import { useInvalidateHomeList } from '../../hooks/useInvalidateHomeList';

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
  const [members, setMembers] = useState<HouseholdMemberRow[]>([]);
  const [sentInvites, setSentInvites] = useState<HouseholdInviteRow[]>([]);
  const [incomingInvites, setIncomingInvites] = useState<HouseholdInviteRow[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [acceptBusy, setAcceptBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [memberRows, pendingSent] = await Promise.all([
        fetchHouseholdMembers(),
        fetchPendingInvitesSent(),
      ]);
      setMembers(memberRows);
      setSentInvites(pendingSent);

      const { data } = await supabase.auth.getUser();
      const email = resolveAuthAccountEmail(data.user);
      if (email) {
        const incoming = await fetchPendingInvitesForEmail(email);
        setIncomingInvites(incoming);
      } else {
        setIncomingInvites([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load sharing settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const memberLabels = useMemo(
    () =>
      members.map((m) => ({
        ...m,
        title: m.user_id === userId ? 'You' : m.role === 'owner' ? 'Owner' : 'Member',
        subtitle: m.role === 'owner' ? 'List owner' : 'Shared access',
      })),
    [members, userId]
  );

  const handleInvite = async () => {
    setInviteBusy(true);
    try {
      const invite = await createHouseholdInvite(inviteEmail);
      setInviteEmail('');
      await load();
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

  const handleAccept = async (token: string) => {
    setAcceptBusy(token);
    try {
      const result = await acceptHouseholdInvite(token);
      if (!result.ok) {
        Alert.alert('Invite not accepted', inviteErrorMessage(result.error));
        return;
      }
      invalidateHomeList();
      await load();
      Alert.alert('List shared', 'You now shop from the same list.');
    } catch (e) {
      Alert.alert('Could not accept invite', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setAcceptBusy(null);
    }
  };

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
              await load();
            } catch (e) {
              Alert.alert('Could not revoke', e instanceof Error ? e.message : 'Unknown error');
            }
          })();
        },
      },
    ]);
  };

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
          {loading ? (
            <Text style={[theme.typography.body, { color: theme.textSecondary, textAlign: 'center' }]}>
              Loading…
            </Text>
          ) : error ? (
            <QueryLoadErrorPanel message={error} onRetry={() => void load()} />
          ) : (
            <>
              <ListSection title="About sharing" {...settingsListSectionProps}>
                <Text style={[theme.typography.body, { color: theme.textSecondary, lineHeight: 22 }]}>
                  Invite one person to shop from the same grocery list, meals, and recipes.
                </Text>
              </ListSection>

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
                {memberLabels.length === 0 ? (
                  <EmptyState
                    icon="people-outline"
                    mascot="hero"
                    title="Just you for now"
                    message="Send an invite to share your list."
                    glass={false}
                  />
                ) : (
                  memberLabels.map((m, index) => (
                    <ListRow
                      key={m.user_id}
                      title={m.title}
                      subtitle={m.subtitle}
                      showSeparator={index < memberLabels.length - 1}
                      fullWidthDivider
                    />
                  ))
                )}
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
