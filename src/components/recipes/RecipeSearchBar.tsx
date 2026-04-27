import React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/ThemeContext';
import { GlassView } from '../ui/GlassView';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';

type RecipeSearchBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** When true, removes bottom margin (e.g. when used in header). */
  compact?: boolean;
};

/**
 * Default: capsule field for in-content use.
 * `compact`: same outer treatment as List tab `SegmentedPillControl` (GlassView + xxs inset + 36pt track).
 */
export function RecipeSearchBar({
  value,
  onChangeText,
  placeholder = 'Search by name or ingredient',
  compact = false,
}: RecipeSearchBarProps) {
  const theme = useTheme();

  if (compact) {
    return (
      <GlassView style={styles.compactGlass} intensity={28} borderRadius={theme.radius.full}>
        <View style={styles.compactInner}>
          <Ionicons
            name="search-outline"
            size={20}
            color={theme.textSecondary}
            style={styles.compactIcon}
          />
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={theme.textSecondary}
            style={[theme.typography.body, styles.compactInput, { color: theme.textPrimary }]}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
        </View>
      </GlassView>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.surface,
          borderColor: theme.divider,
        },
      ]}
    >
      <Ionicons name="search-outline" size={20} color={theme.textSecondary} style={styles.icon} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        style={[theme.typography.body, styles.input, { color: theme.textPrimary }]}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="search"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  compactGlass: {
    padding: spacing.xxs,
  },
  compactInner: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
  },
  compactIcon: {
    marginRight: spacing.sm,
  },
  compactInput: {
    flex: 1,
    paddingVertical: 0,
    minHeight: 36,
    paddingRight: spacing.xs,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  icon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 44,
    paddingVertical: spacing.sm,
    paddingRight: spacing.xs,
  },
});
