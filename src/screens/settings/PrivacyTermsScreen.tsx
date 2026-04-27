import React, { useCallback } from 'react';
import { StyleSheet, ScrollView, Linking, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../design/ThemeContext';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { SettingsStackParamList } from '../../navigation/types';
import { useSettingsScrollHandler } from '../../navigation/NavigationChromeScrollContext';
import { Screen } from '../../components/ui/Screen';
import { useSettingsScrollInsets } from './settingsScrollLayout';
import { ListSection } from '../../components/ui/ListSection';
import { ListRow } from '../../components/ui/ListRow';
import { Chevron } from './SettingsChevron';
import { spacing } from '../../design/spacing';
import { PRIVACY_POLICY_URL, TERMS_OF_USE_URL } from '../../constants/legalUrls';

export function PrivacyTermsScreen() {
  const onScroll = useSettingsScrollHandler();
  const scrollInsets = useSettingsScrollInsets();
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<SettingsStackParamList>>();

  const openLegalUrl = useCallback((url: string) => {
    void Linking.openURL(url).catch(() => {
      Alert.alert('Could not open link', 'Open thelistioapp.com in your browser to read this document.');
    });
  }, []);

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
        <ListSection title="Documents" titleVariant="small" glass={false} style={styles.section}>
          <ListRow
            title="Privacy policy"
            onPress={() => openLegalUrl(PRIVACY_POLICY_URL)}
            rightAccessory={<Chevron />}
            showSeparator
            fullWidthDivider
          />
          <ListRow
            title="Terms of service"
            onPress={() => openLegalUrl(TERMS_OF_USE_URL)}
            rightAccessory={<Chevron />}
            showSeparator={false}
            fullWidthDivider
          />
        </ListSection>

        <ListSection title="Account controls" titleVariant="small" glass={false} style={styles.section}>
          <ListRow
            title="Delete account"
            subtitle="Delete your account and everything stored with it"
            onPress={() => navigation.navigate('DeleteAccount')}
            rightAccessory={<Chevron />}
            showSeparator={false}
            fullWidthDivider
            titleStyle={{ color: theme.danger }}
          />
        </ListSection>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {},
  section: { marginBottom: spacing.lg },
});
