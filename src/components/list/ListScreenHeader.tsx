import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/ThemeContext';
import { listTabSwitcherHeaderHeight } from '../../design/layout';
import { NavigationChromeSurface } from '../../ui/chrome/NavigationChromeSurface';
import { PressableScale } from '../ui/PressableScale';

type ListSwitcher = {
  name: string;
  onPress: () => void;
};

type ListScreenHeaderProps = {
  listSwitcher: ListSwitcher;
  /** While reordering sections, switcher is hidden. */
  reorderMode?: boolean;
};

/** List tab header chrome — multi-list switcher only. Plan/Shop lives in `ListModeToggleBar`. */
export function ListScreenHeader({ listSwitcher, reorderMode = false }: ListScreenHeaderProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: {
          backgroundColor: 'transparent',
          height: listTabSwitcherHeaderHeight(insets.top, theme.spacing),
          paddingHorizontal: theme.spacing.md,
          paddingTop: insets.top,
          paddingBottom: theme.spacing.xs,
        },
        listSwitcherRow: {
          minHeight: 44,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.xs,
          alignSelf: 'flex-start',
          maxWidth: '100%',
        },
        listSwitcherTitle: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.xxs,
          flexShrink: 1,
          minWidth: 0,
        },
        listSwitcherName: {
          flexShrink: 1,
        },
      }),
    [insets.top, theme]
  );

  if (reorderMode) return null;

  return (
    <NavigationChromeSurface tabKey="ListTab">
      <View style={styles.safe}>
        <PressableScale
          onPress={listSwitcher.onPress}
          pressedOpacity={0.94}
          style={styles.listSwitcherRow}
          accessibilityRole="button"
          accessibilityLabel={`Switch list, ${listSwitcher.name}`}
          accessibilityHint="Opens your lists so you can switch to another list"
        >
          <Ionicons name="albums-outline" size={18} color={theme.accent} />
          <View style={styles.listSwitcherTitle}>
            <Text
              style={[
                theme.typography.subhead,
                styles.listSwitcherName,
                { color: theme.textPrimary, fontWeight: '600' },
              ]}
              numberOfLines={1}
            >
              {listSwitcher.name}
            </Text>
            <Ionicons name="chevron-down" size={14} color={theme.textSecondary} />
          </View>
        </PressableScale>
      </View>
    </NavigationChromeSurface>
  );
}
