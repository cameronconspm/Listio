import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../design/ThemeContext';
import { tabRootHeaderHeight } from '../../design/layout';
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
  const insets = useSafeAreaInsets();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: {
          backgroundColor: 'transparent',
          height: tabRootHeaderHeight(insets.top, theme.spacing),
          paddingHorizontal: theme.spacing.md,
          paddingTop: insets.top + theme.spacing.sm,
          paddingBottom: theme.spacing.xs,
        },
        row: {
          height: 44,
          justifyContent: 'center',
        },
      }),
    [insets.top, theme],
  );

  return (
    <NavigationChromeSurface tabKey="MealsStack">
      <View style={styles.safe}>
        <View style={styles.row}>
          <ScheduleControl
            label={scheduleLabel}
            onPress={onSchedulePress}
            onPrev={onPrev}
            onNext={onNext}
          />
        </View>
      </View>
    </NavigationChromeSurface>
  );
}
