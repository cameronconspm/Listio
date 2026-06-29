import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/ThemeContext';
import { listTabSwitcherHeaderHeight } from '../../design/layout';
import { NavigationChromeSurface } from '../../ui/chrome/NavigationChromeSurface';
import { PressableScale } from '../ui/PressableScale';
import { Mascot, type MascotMood } from '../brand/Mascot';

/** Fits the 44pt header row beside the list switcher without crowding the title. */
export const LIST_TAB_HEADER_MASCOT_SIZE = 38;

type ListSwitcher = {
  name: string;
  onPress: () => void;
};

type ListTabMascot = {
  mood: MascotMood;
  accessibilityLabel: string;
};

type ListScreenHeaderProps = {
  listSwitcher?: ListSwitcher | null;
  mascot?: ListTabMascot | null;
  /** While reordering sections, header chrome is hidden. */
  reorderMode?: boolean;
};

/** List tab header — list switcher (left) and mascot (right). Plan/Shop lives in `ListModeToggleBar`. */
export function ListScreenHeader({
  listSwitcher = null,
  mascot = null,
  reorderMode = false,
}: ListScreenHeaderProps) {
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
        headerRow: {
          minHeight: 44,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
        },
        listSwitcherRow: {
          minHeight: 44,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.xs,
          flexShrink: 1,
          minWidth: 0,
          maxWidth: '72%',
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
        mascotSlot: {
          flexShrink: 0,
          overflow: 'visible',
          alignItems: 'flex-end',
          justifyContent: 'center',
        },
      }),
    [insets.top, theme]
  );

  if (reorderMode) return null;
  if (!listSwitcher && !mascot) return null;

  return (
    <NavigationChromeSurface tabKey="ListTab">
      <View style={styles.safe}>
        <View style={styles.headerRow}>
          {listSwitcher ? (
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
          ) : (
            <View style={styles.listSwitcherRow} />
          )}
          {mascot ? (
            <View style={styles.mascotSlot} pointerEvents="none">
              <Mascot
                mood={mascot.mood}
                size={LIST_TAB_HEADER_MASCOT_SIZE}
                animate
                skipEntrance
                accessibilityLabel={mascot.accessibilityLabel}
              />
            </View>
          ) : null}
        </View>
      </View>
    </NavigationChromeSurface>
  );
}
