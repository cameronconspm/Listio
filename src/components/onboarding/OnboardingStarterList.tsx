import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/ThemeContext';
import { useHaptics } from '../../hooks/useHaptics';
import { STARTER_GROCERIES } from '../../constants/starterGroceries';
import { OnboardingStagger } from './OnboardingStagger';

type Props = {
  /** Names currently selected. */
  selected: ReadonlySet<string>;
  onToggle: (name: string) => void;
};

/**
 * One-tap chips of common staples. Tapping toggles a pick; the parent seeds the
 * selected items into the real list so the user lands on a non-empty, sorted list.
 */
export function OnboardingStarterList({ selected, onToggle }: Props) {
  const theme = useTheme();
  const haptics = useHaptics();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          alignSelf: 'stretch',
        },
        chipRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
        },
        chip: {
          minHeight: 44,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.xs,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.full,
          borderWidth: StyleSheet.hairlineWidth,
        },
        chipText: {
          ...theme.typography.body,
        },
        hint: {
          ...theme.typography.footnote,
          color: theme.textSecondary,
          marginTop: theme.spacing.md,
          textAlign: 'center',
        },
      }),
    [theme]
  );

  return (
    <View style={styles.wrap}>
      <OnboardingStagger index={0}>
        <View style={styles.chipRow}>
          {STARTER_GROCERIES.map((item) => {
            const isSelected = selected.has(item.name);
            return (
              <Pressable
                key={item.name}
                onPress={() => {
                  haptics.selection();
                  onToggle(item.name);
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={item.name}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: isSelected ? theme.accent : theme.surface,
                    borderColor: isSelected ? theme.accent : theme.divider,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Ionicons
                  name={isSelected ? 'checkmark-circle' : 'add-circle-outline'}
                  size={18}
                  color={isSelected ? theme.onAccent : theme.textSecondary}
                />
                <Text
                  style={[
                    styles.chipText,
                    { color: isSelected ? theme.onAccent : theme.textPrimary },
                  ]}
                >
                  {item.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </OnboardingStagger>
      <Text style={styles.hint}>
        {selected.size > 0
          ? `${selected.size} added — we'll sort them by aisle for you.`
          : 'Tap a few to start — or skip and add your own later.'}
      </Text>
    </View>
  );
}
