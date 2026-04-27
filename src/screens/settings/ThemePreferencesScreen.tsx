import React, { useCallback, useMemo } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
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
import { fetchUserPreferences, patchUserPreferences } from '../../services/userPreferencesService';
import { isSyncEnabled } from '../../services/supabaseClient';
import { spacing } from '../../design/spacing';

const THEME_LABEL: Record<ThemePreference, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

function normalizeThemePreference(raw: unknown): ThemePreference {
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
}

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

  useFocusEffect(
    useCallback(() => {
      if (!isSyncEnabled()) return;
      let active = true;
      void fetchUserPreferences()
        .then((prefs) => {
          if (!active) return;
          setSelectedTheme(normalizeThemePreference(prefs.appearance?.selectedTheme));
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }, [setSelectedTheme])
  );

  const handleChange = async (next: ThemePreference) => {
    const previous = selectedTheme;
    setSelectedTheme(next);
    if (!isSyncEnabled()) return;
    try {
      await patchUserPreferences({ appearance: { selectedTheme: next } });
    } catch (e) {
      setSelectedTheme(previous);
      Alert.alert(
        'Could not save theme',
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
              onChange={(value) => {
                void handleChange(value);
              }}
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
