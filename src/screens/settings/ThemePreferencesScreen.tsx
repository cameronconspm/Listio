import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  useTheme,
  useThemePreference,
  type ThemePreference,
} from '../../design/ThemeContext';
import { Screen } from '../../components/ui/Screen';
import { ListSection } from '../../components/ui/ListSection';
import { SegmentedPillControl } from '../../ui/components/SegmentedPillControl/SegmentedPillControl';
import { useSettingsScrollHandler } from '../../navigation/NavigationChromeScrollContext';
import { useSettingsScrollInsets } from './settingsScrollLayout';
import { spacing } from '../../design/spacing';
import { SettingsPushedScreenHeader } from './SettingsPushedScreenHeader';

const THEME_LABEL: Record<ThemePreference, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

export function ThemePreferencesScreen() {
  const theme = useTheme();
  const onScroll = useSettingsScrollHandler();
  const scrollInsets = useSettingsScrollInsets();
  const { selectedTheme, setSelectedTheme } = useThemePreference();

  const helperText = useMemo(() => {
    if (selectedTheme === 'system') {
      return 'Listio follows your iPhone appearance setting.';
    }
    if (selectedTheme === 'dark') {
      return 'Listio stays in dark mode, even when your phone is set to light.';
    }
    return 'Listio stays in light mode, even when your phone is set to dark.';
  }, [selectedTheme]);

  return (
    <Screen padded safeTop={false} safeBottom={false}>
      <SettingsPushedScreenHeader title="Theme" />
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
        <ListSection title="Appearance" titleVariant="small" glass={false} style={styles.section}>
          <View style={styles.controlWrap}>
            <SegmentedPillControl<ThemePreference>
              segments={[
                { key: 'system', label: THEME_LABEL.system },
                { key: 'light', label: THEME_LABEL.light },
                { key: 'dark', label: THEME_LABEL.dark },
              ]}
              value={selectedTheme}
              onChange={setSelectedTheme}
            />
            <Text
              style={[
                theme.typography.footnote,
                { color: theme.textSecondary, marginTop: theme.spacing.md, lineHeight: 19 },
              ]}
            >
              {helperText}
            </Text>
          </View>
        </ListSection>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {},
  section: { marginBottom: spacing.lg },
  controlWrap: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
