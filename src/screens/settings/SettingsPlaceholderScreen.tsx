import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import type { SettingsStackParamList } from '../../navigation/types';
import { useTheme } from '../../design/ThemeContext';
import { useResetSettingsScrollOnFocus } from '../../navigation/NavigationChromeScrollContext';
import { Screen } from '../../components/ui/Screen';
import { useSettingsScrollInsets } from './settingsScrollLayout';
import { ListSection } from '../../components/ui/ListSection';
import { settingsListSectionProps } from '../../design/settingsLayout';
import { SettingsPushedScreenHeader } from './SettingsPushedScreenHeader';

type SettingsPlaceholderScreenProps = {
  route: RouteProp<SettingsStackParamList, 'SettingsPlaceholder'>;
};

/**
 * Placeholder destination for Settings rows that don't have full implementations yet.
 * Keeps the screen on-brand with grouped placeholder content.
 */
export function SettingsPlaceholderScreen({ route }: SettingsPlaceholderScreenProps) {
  const theme = useTheme();
  useResetSettingsScrollOnFocus();
  const scrollInsets = useSettingsScrollInsets();
  const title = route.params?.title ?? 'Settings';

  return (
    <Screen padded safeTop={false} safeBottom={false}>
      <SettingsPushedScreenHeader title={title} />
      <View
        style={[
          styles.content,
          {
            paddingTop: scrollInsets.paddingTop,
            paddingBottom: scrollInsets.paddingBottom,
          },
        ]}
      >
        <ListSection title="Coming soon" {...settingsListSectionProps}>
          <Text style={[theme.typography.body, { color: theme.textSecondary }]}>
            {title} will be available in a future update.
          </Text>
        </ListSection>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
});
