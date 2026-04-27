import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../../design/ThemeContext';
import { useSettingsScrollHandler } from '../../navigation/NavigationChromeScrollContext';
import { Screen } from '../../components/ui/Screen';
import { useSettingsScrollInsets } from './settingsScrollLayout';
import { ListSection } from '../../components/ui/ListSection';
import { ListRow } from '../../components/ui/ListRow';
import { AppConfirmationDialog } from '../../components/ui/AppConfirmationDialog';
import { Chevron } from './SettingsChevron';
import { useOnboardingControls } from '../../context/OnboardingControlsContext';
import { spacing } from '../../design/spacing';

export function OnboardingScreen() {
  const onScroll = useSettingsScrollHandler();
  const scrollInsets = useSettingsScrollInsets();
  const theme = useTheme();
  const { startReplayOnboarding, resetOnboardingCompletion } = useOnboardingControls();
  const [showResetConfirm, setShowResetConfirm] = useState(false);

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
        <ListSection title="Intro" titleVariant="small" glass={false} style={styles.section}>
          <View style={[styles.helper, { backgroundColor: theme.surface }]}>
            <Text style={[theme.typography.body, { color: theme.textSecondary, lineHeight: 22 }]}>
              Watch the welcome flow again, or reset so it appears the next time you open the app.
            </Text>
          </View>
        </ListSection>

        <ListSection title="Actions" titleVariant="small" glass={false} style={styles.section}>
          <ListRow
            title="Replay onboarding"
            subtitle="Watch the welcome flow from the start"
            onPress={() => startReplayOnboarding()}
            rightAccessory={<Chevron />}
            showSeparator
            fullWidthDivider
          />
          <ListRow
            title="Reset onboarding progress"
            subtitle="Show the welcome flow again on next launch"
            onPress={() => setShowResetConfirm(true)}
            rightAccessory={<Chevron />}
            showSeparator={false}
            fullWidthDivider
          />
        </ListSection>
      </ScrollView>

      <AppConfirmationDialog
        visible={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        title="Reset onboarding?"
        message="You will see the intro flow again. Your lists, meals, recipes, and stores are not deleted."
        buttons={[
          { label: 'Cancel', cancel: true, onPress: () => setShowResetConfirm(false) },
          {
            label: 'Reset',
            onPress: () => {
              setShowResetConfirm(false);
              void resetOnboardingCompletion();
            },
          },
        ]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {},
  section: { marginBottom: spacing.lg },
  helper: {
    padding: spacing.md,
  },
});
