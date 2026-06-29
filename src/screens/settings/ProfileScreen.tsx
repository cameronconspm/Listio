import React, { useState, useCallback } from 'react';
import { Text, View, StyleSheet, ScrollView, Keyboard, Alert } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { SettingsStackParamList } from '../../navigation/types';
import { useTheme } from '../../design/ThemeContext';
import { useSettingsScrollHandler } from '../../navigation/NavigationChromeScrollContext';
import { Screen } from '../../components/ui/Screen';
import { KeyboardSafeForm } from '../../components/ui/KeyboardSafeForm';
import { useSettingsScrollInsets } from './settingsScrollLayout';
import { ListSection } from '../../components/ui/ListSection';
import { ListRow } from '../../components/ui/ListRow';
import { TextField } from '../../components/ui/TextField';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { Chevron } from './SettingsChevron';
import { supabase, isSyncEnabled } from '../../services/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import {
  settingsFieldLastStyle,
  settingsFieldStyle,
  settingsListSectionProps,
  settingsMascotHeaderStyle,
  settingsRowListSectionProps,
  SETTINGS_SECTION_GAP,
} from '../../design/settingsLayout';
import { SettingsPushedScreenHeader } from './SettingsPushedScreenHeader';
import { Mascot } from '../../components/brand/Mascot';

export function ProfileScreen() {
  const theme = useTheme();
  const { userEmail } = useAuth();
  const onScroll = useSettingsScrollHandler();
  const scrollInsets = useSettingsScrollInsets();
  const navigation = useNavigation<NativeStackNavigationProp<SettingsStackParamList>>();
  const [fullName, setFullName] = useState('');
  const [initialFullName, setInitialFullName] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(() => {
    if (!isSyncEnabled()) {
      setFullName('');
      setInitialFullName('');
      return;
    }
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      const name = (u?.user_metadata?.full_name as string | undefined) ?? '';
      setFullName(name);
      setInitialFullName(name);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const hasChanges = isSyncEnabled() && fullName.trim() !== initialFullName.trim();

  const handleSave = async () => {
    Keyboard.dismiss();
    if (!isSyncEnabled()) return;
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim() || undefined },
      });
      if (error) {
        Alert.alert('Could not update profile', error.message);
        return;
      }
      setInitialFullName(fullName.trim());
      Alert.alert('Saved', 'Your display name was updated.');
    } finally {
      setSaving(false);
    }
  };

  const syncOn = isSyncEnabled();

  return (
    <Screen padded safeTop={false} safeBottom={false}>
      <SettingsPushedScreenHeader title="Profile" />
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
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={settingsMascotHeaderStyle}>
            <Mascot
              mood="hero"
              size={96}
              animate
              accessibilityLabel="Listio mascot"
            />
          </View>
          <ListSection title="Account info" {...settingsListSectionProps}>
            {syncOn ? (
              <>
                <TextField
                  label="Full name"
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Your name"
                  containerStyle={settingsFieldStyle}
                />
                <TextField
                  label="Email address"
                  value={userEmail ?? ''}
                  onChangeText={() => {}}
                  placeholder="you@example.com"
                  editable={false}
                  containerStyle={settingsFieldLastStyle}
                />
                <Text style={[theme.typography.caption1, { color: theme.textSecondary, marginTop: theme.spacing.xs }]}>
                  To change your email, sign out and sign in with a different account.
                </Text>
              </>
            ) : (
              <Text style={[theme.typography.body, { color: theme.textSecondary, lineHeight: 22 }]}>
                Sign in to see and edit your name and email.
              </Text>
            )}
          </ListSection>

          <ListSection title="Security" {...settingsRowListSectionProps}>
            <ListRow
              title="Change password"
              subtitle={syncOn ? 'Change the password you use to sign in' : 'Available after you sign in'}
              onPress={syncOn ? () => navigation.navigate('ChangePassword') : undefined}
              rightAccessory={<Chevron />}
              showSeparator={false}
              fullWidthDivider
            />
          </ListSection>

          {hasChanges ? (
            <PrimaryButton
              title="Save"
              onPress={handleSave}
              loading={saving}
              style={{ marginTop: SETTINGS_SECTION_GAP }}
            />
          ) : null}
        </ScrollView>
      </KeyboardSafeForm>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flex: 1 },
  content: {},
});
