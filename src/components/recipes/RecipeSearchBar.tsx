import React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/ThemeContext';
import { GlassView } from '../ui/GlassView';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';

/** Same 44pt row minimum as recipe/meal editor single-line fields and unit control. */
const SEARCH_BAR_ROW_MIN_HEIGHT = 44;

type RecipeSearchBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** When true, removes bottom margin (e.g. when used in header). */
  compact?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  inputRef?: React.Ref<TextInput>;
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
  onFocus,
  onBlur,
  inputRef,
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
            ref={inputRef}
            value={value}
            onChangeText={onChangeText}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder={placeholder}
            placeholderTextColor={theme.textSecondary}
            style={[theme.typography.body, styles.compactInput, { color: theme.textPrimary }]}
            textAlign="left"
            textAlignVertical="center"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            keyboardAppearance={theme.colorScheme}
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
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        style={[theme.typography.body, styles.input, { color: theme.textPrimary }]}
        textAlign="left"
        textAlignVertical="center"
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        keyboardAppearance={theme.colorScheme}
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
    minHeight: SEARCH_BAR_ROW_MIN_HEIGHT,
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
    minHeight: SEARCH_BAR_ROW_MIN_HEIGHT,
    paddingVertical: spacing.sm,
    paddingRight: spacing.xs,
  },
});
