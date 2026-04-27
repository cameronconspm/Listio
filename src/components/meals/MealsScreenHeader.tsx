import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../design/ThemeContext';
import { NavigationChromeSurface } from '../../ui/chrome/NavigationChromeSurface';
import { ScheduleControl } from './ScheduleControl';

type MealsScreenHeaderProps = {
  scheduleLabel: string;
  onSchedulePress: () => void;
  onPrev: () => void;
  onNext: () => void;
};

/**
 * Stack header: schedule range only. Week strip renders in screen body (same vertical rhythm).
 */
export function MealsScreenHeader({
  scheduleLabel,
  onSchedulePress,
  onPrev,
  onNext,
}: MealsScreenHeaderProps) {
  const theme = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: {
          backgroundColor: 'transparent',
          paddingHorizontal: theme.spacing.md,
          paddingTop: theme.spacing.sm,
          paddingBottom: theme.spacing.xs,
        },
      }),
    [theme],
  );

  return (
    <NavigationChromeSurface tabKey="MealsStack">
      <SafeAreaView edges={['top']} style={styles.safe}>
        <ScheduleControl
          label={scheduleLabel}
          onPress={onSchedulePress}
          onPrev={onPrev}
          onNext={onNext}
        />
      </SafeAreaView>
    </NavigationChromeSurface>
  );
}
