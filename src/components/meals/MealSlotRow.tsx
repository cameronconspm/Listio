import React from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useTheme } from '../../design/ThemeContext';
import { cardShellStyle } from '../ui/Card';
import { useHaptics } from '../../hooks/useHaptics';
import type { Meal } from '../../types/models';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';
import {
  formatMealPlannerRecipeMetaLine,
  type MealPlannerRecipeMeta,
} from '../../utils/formatMealPlannerRecipeMeta';

const MIN_TOUCH_TARGET = 44;

const SLOT_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  dessert: 'Dessert',
  custom: 'Custom',
};

type MealSlotRowProps = {
  slotKey: string;
  slotLabel: string;
  meal: Meal | null;
  recipeMeta: MealPlannerRecipeMeta | null;
  ingredientCount: number;
  onPressMeal: () => void;
  onPressAdd: () => void;
  onDeleteMeal?: (meal: Meal) => void;
};

function displaySlotLabel(slotKey: string, slotLabel: string): string {
  if (slotKey.startsWith('custom:')) {
    return slotLabel.trim() || 'Custom';
  }
  return SLOT_LABELS[slotKey] ?? slotLabel.charAt(0).toUpperCase() + slotLabel.slice(1).toLowerCase();
}

/**
 * Empty: label, muted hint, + Add. Filled: slot eyebrow + inset tile (swipe to delete, tap tile or chevron for detail).
 */
export function MealSlotRow({
  slotKey,
  slotLabel,
  meal,
  recipeMeta,
  ingredientCount,
  onPressMeal,
  onPressAdd,
  onDeleteMeal,
}: MealSlotRowProps) {
  const theme = useTheme();
  const haptics = useHaptics();
  const label = displaySlotLabel(slotKey, slotLabel);
  const mealTypeLabelStyle = [theme.typography.subhead, { color: theme.textPrimary, fontWeight: '600' as const }];

  if (meal) {
    const recipeLine = meal.recipe_id ? formatMealPlannerRecipeMetaLine(recipeMeta) : null;
    const fallbackMeta =
      !recipeLine && ingredientCount > 0
        ? `${ingredientCount} ingredient${ingredientCount !== 1 ? 's' : ''}`
        : null;
    const metaText = recipeLine ?? fallbackMeta;

    const handleSwipeDelete = () => {
      haptics.light();
      onDeleteMeal?.(meal);
    };

    const renderRightActions = () => (
      <View style={styles.swipeActionsOuterRight}>
        <TouchableOpacity
          style={[styles.swipeActionDelete, { backgroundColor: theme.danger + '25' }]}
          onPress={handleSwipeDelete}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${meal.name}`}
        >
          <Ionicons name="trash-outline" size={20} color={theme.danger} />
        </TouchableOpacity>
      </View>
    );

    const tile = (
      <Pressable
        style={[
          styles.mealTile,
          cardShellStyle(theme, 'nested', 'interactive'),
        ]}
        onPress={onPressMeal}
        accessibilityRole="button"
        accessibilityLabel={`Open ${meal.name}, meal details`}
      >
        <View style={styles.mealTitleRow}>
          <Text style={[theme.typography.headline, styles.mealTitle, { color: theme.textPrimary }]} numberOfLines={2}>
            {meal.name}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={theme.textSecondary}
            style={styles.mealChevron}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        </View>
        {metaText ? (
          <Text
            style={[theme.typography.footnote, styles.metaLine, { color: theme.textSecondary }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {metaText}
          </Text>
        ) : null}
      </Pressable>
    );

    return (
      <View style={[styles.filledWrap, { borderBottomColor: theme.divider }]}>
        <Text style={[...mealTypeLabelStyle, { marginBottom: theme.spacing.xs }]}>{label}</Text>
        {onDeleteMeal ? (
          <View style={styles.swipeClip}>
            <ReanimatedSwipeable
              renderRightActions={renderRightActions}
              friction={2}
              overshootRight={false}
            >
              {tile}
            </ReanimatedSwipeable>
          </View>
        ) : (
          tile
        )}
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.emptyRow, { borderBottomColor: theme.divider }]}
      onPress={onPressAdd}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Add meal, ${label}`}
    >
      <View style={[styles.emptyLeftCol, { paddingRight: theme.spacing.xs }]}>
        <Text style={mealTypeLabelStyle} numberOfLines={1} ellipsizeMode="tail">
          {label}
        </Text>
        <Text
          style={[theme.typography.caption1, { color: theme.textSecondary, marginTop: theme.spacing.xxs }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          Nothing planned
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={[theme.typography.body, { color: theme.accent }]}>+ Add</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  filledWrap: {
    paddingVertical: spacing.comfort,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  swipeClip: {
    overflow: 'hidden' as const,
    borderRadius: radius.md,
  },
  mealTile: {
    borderRadius: radius.md,
    padding: spacing.base,
  },
  mealTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  mealTitle: {
    flex: 1,
    minWidth: 0,
    paddingRight: spacing.sm,
  },
  mealChevron: {
    marginTop: 2,
  },
  metaLine: {
    marginTop: spacing.sm,
  },
  swipeActionsOuterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: spacing.sm,
    minWidth: MIN_TOUCH_TARGET + spacing.sm + spacing.sm,
  },
  swipeActionDelete: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: MIN_TOUCH_TARGET / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 56,
  },
  emptyLeftCol: {
    flex: 1,
    minWidth: 0,
  },
  rowRight: {
    flexShrink: 0,
    alignSelf: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
});
