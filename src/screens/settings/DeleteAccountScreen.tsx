import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../design/ThemeContext';
import { useSettingsScrollHandler } from '../../navigation/NavigationChromeScrollContext';
import { Screen } from '../../components/ui/Screen';
import { useSettingsScrollInsets } from './settingsScrollLayout';
import { ListSection } from '../../components/ui/ListSection';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { AppConfirmationDialog } from '../../components/ui/AppConfirmationDialog';
import { deleteAuthenticatedAccount } from '../../services/deleteAccountService';
import { isSyncEnabled } from '../../services/supabaseClient';
import { clearPersistedQueryCache } from '../../query/reactQueryPersistence';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';

export function DeleteAccountScreen() {
  const onScroll = useSettingsScrollHandler();
  const scrollInsets = useSettingsScrollInsets();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const [confirmText, setConfirmText] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canDelete = confirmText.toUpperCase() === 'DELETE';

  const handleDeletePress = () => {
    if (canDelete) setShowConfirm(true);
  };

  const handleConfirmDelete = async () => {
    setShowConfirm(false);
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
        <ListSection title="Warning" titleVariant="small" glass={false} style={styles.section}>
          <View style={[styles.warningBox, { backgroundColor: theme.surface }]}>
            <Text style={[theme.typography.body, { color: theme.textSecondary, lineHeight: 22 }]}>
              This deletes your account and everything in Listio tied to it—lists, meals, and recipes. You can’t get this
              data back.
            </Text>
          </View>
        </ListSection>

        <ListSection title="Confirm" titleVariant="small" glass={false} style={styles.section}>
          <View style={styles.fieldWrap}>
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
                styles.input,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.divider,
                  color: theme.textPrimary,
                },
              ]}
              value={confirmText}
              onChangeText={setConfirmText}
              placeholder="DELETE"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>
        </ListSection>

        <ListSection title="Action" titleVariant="small" glass={false} style={styles.section}>
          <PrimaryButton
            title="Delete account"
            onPress={handleDeletePress}
            disabled={!canDelete || deleting}
            loading={deleting}
            style={{ backgroundColor: theme.danger }}
          />
        </ListSection>
      </ScrollView>

      <AppConfirmationDialog
        visible={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="Delete account permanently?"
        message="This cannot be undone. Your account and related information will be removed."
        buttons={[
          { label: 'Cancel', cancel: true, onPress: () => setShowConfirm(false) },
          { label: 'Delete account', destructive: true, onPress: handleConfirmDelete },
        ]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {},
  section: { marginBottom: spacing.lg },
  warningBox: {
    padding: spacing.md,
  },
  fieldWrap: {
    paddingHorizontal: 0,
  },
  input: {
    minHeight: 50,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.input,
    borderWidth: 1,
  },
});
