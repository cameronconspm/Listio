import React from 'react';
import { View, Text, Pressable, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useTheme } from '../../design/ThemeContext';
import { useHaptics } from '../../hooks/useHaptics';
import type { Recipe, RecipeCategory } from '../../types/models';
import { formatRecipeDurationMinutes } from '../../utils/formatRecipeDuration';
import { RecipeMetaPills } from './RecipeMetaPills';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';

const MIN_TOUCH_TARGET = 44;

const CATEGORY_LABELS: Record<RecipeCategory, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  dessert: 'Dessert',
  snack: 'Snack',
  other: 'Other',
};

function formatCategory(cat: RecipeCategory | null | undefined): string {
  if (!cat) return '';
  return CATEGORY_LABELS[cat] ?? cat;
}

type RecipeCardProps = {
  recipe: Recipe;
  ingredientCount: number;
  onPress: () => void;
  onFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

function RecipeCardInner({ recipe, ingredientCount, onPress, onFavorite, onEdit, onDelete }: RecipeCardProps) {
  const theme = useTheme();
  const haptics = useHaptics();

  const timeLabel = formatRecipeDurationMinutes(recipe.total_time_minutes);
  const pillLabels: string[] = [];
  if (timeLabel) pillLabels.push(timeLabel);
  pillLabels.push(`${recipe.servings} servings`);
  pillLabels.push(
    `${ingredientCount} ingredient${ingredientCount === 1 ? '' : 's'}`
  );
  const categoryLabel = formatCategory(recipe.category);
  if (categoryLabel) pillLabels.push(categoryLabel);
  const isFavorite = recipe.is_favorite === true;

  const handleSwipeDeletePress = () => {
    haptics.light();
    onDelete();
  };

  const renderLeftActions = () => (
    <View style={styles.swipeActionsOuterLeft}>
      <TouchableOpacity
        style={[styles.swipeActionCircle, { backgroundColor: theme.textSecondary + '20' }]}
        onPress={() => {
          haptics.light();
          onFavorite();
        }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={isFavorite ? 'Remove favorite' : 'Favorite recipe'}
      >
        <Ionicons
          name={isFavorite ? 'heart' : 'heart-outline'}
          size={20}
          color={isFavorite ? theme.accent : theme.textPrimary}
        />
      </TouchableOpacity>
    </View>
  );

  const renderRightActions = () => (
    <View style={styles.swipeActionsOuterRight}>
      <TouchableOpacity
        style={[styles.swipeActionCircle, { backgroundColor: theme.textSecondary + '20' }]}
        onPress={() => {
          haptics.light();
          onEdit();
        }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Edit recipe"
      >
        <Ionicons name="pencil-outline" size={20} color={theme.textPrimary} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.swipeActionDelete, { backgroundColor: theme.danger + '25' }]}
        onPress={handleSwipeDeletePress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Delete recipe"
      >
        <Ionicons name="trash-outline" size={20} color={theme.danger} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.cardOuter, { borderRadius: theme.radius.card }, theme.shadows.card]}>
      <View style={[styles.swipeClip, { borderRadius: theme.radius.card }]}>
        <ReanimatedSwipeable
          renderLeftActions={renderLeftActions}
          renderRightActions={renderRightActions}
          friction={2}
          overshootLeft={false}
          overshootRight={false}
        >
          <Pressable
            onPress={onPress}
            style={({ pressed }) => [
              styles.cardInner,
              {
                backgroundColor: theme.surface,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <View style={styles.headerRow}>
              <Text style={[theme.typography.headline, { color: theme.textPrimary, flex: 1 }]} numberOfLines={2}>
                {recipe.name}
              </Text>
              {isFavorite ? (
                <Ionicons name="heart" size={18} color={theme.accent} style={styles.favoriteIcon} />
              ) : null}
            </View>
            <View style={styles.pillsWrap}>
              <RecipeMetaPills labels={pillLabels} />
            </View>
          </Pressable>
        </ReanimatedSwipeable>
      </View>
    </View>
  );
}

export const RecipeCard = React.memo(RecipeCardInner);

const styles = StyleSheet.create({
  cardOuter: {
    marginBottom: spacing.lg,
  },
  swipeClip: {
    overflow: 'hidden' as const,
  },
  /** Rounded + overflow so the translated swipe row keeps card corners (avoids a square trailing edge). */
  cardInner: {
    padding: spacing.md,
    borderRadius: radius.card,
    overflow: 'hidden' as const,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  favoriteIcon: {
    marginLeft: spacing.sm,
  },
  pillsWrap: {
    marginTop: spacing.sm,
  },
  swipeActionsOuterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: spacing.sm,
    gap: spacing.sm,
    minWidth: MIN_TOUCH_TARGET * 2 + spacing.sm + spacing.sm,
  },
  swipeActionsOuterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingLeft: spacing.sm,
    minWidth: MIN_TOUCH_TARGET + spacing.sm + spacing.sm,
  },
  swipeActionCircle: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: MIN_TOUCH_TARGET / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeActionDelete: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: MIN_TOUCH_TARGET / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
