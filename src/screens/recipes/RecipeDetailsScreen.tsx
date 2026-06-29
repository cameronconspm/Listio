import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Linking,
  TouchableOpacity,
  Share,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RecipesStackParamList } from '../../navigation/types';
import { useTheme } from '../../design/ThemeContext';
import { scrollPaddingBottomWithoutTabBar } from '../../design/layout';
import { Screen } from '../../components/ui/Screen';
import { HeaderIconButton } from '../../components/ui/HeaderIconButton';
import { PushedScreenHeader } from '../../components/ui/PushedScreenHeader';
import { ListSection } from '../../components/ui/ListSection';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { SecondaryButton } from '../../components/ui/SecondaryButton';
import { AppConfirmationDialog } from '../../components/ui/AppConfirmationDialog';
import { NativeContextMenu } from '../../components/ui/NativeContextMenu';
import { IngredientList } from '../../components/recipes/IngredientList';
import { RecipeActionStack } from '../../components/recipes/RecipeActionStack';
import { RecipeMetaPills } from '../../components/recipes/RecipeMetaPills';
import { RecipeInstructionsSection } from '../../components/recipes/RecipeInstructionsSection';
import { RECIPE_CATEGORY_LABELS } from '../../components/recipes/RecipeCategorySheet';
import { formatRecipeDurationMinutes } from '../../utils/formatRecipeDuration';
import { parseRecipeInstructionSteps } from '../../utils/parseRecipeInstructionSteps';
import {
  addRecipeToMeals,
  addRecipeIngredientsToList,
  deleteRecipe,
  duplicateRecipe,
  getRecipes,
  toggleRecipeFavorite,
} from '../../services/recipeService';
import { getMeals } from '../../services/mealService';
import { ensureFreeTierCapacity } from '../../services/freeTierLimits';
import { usePremiumEntitlement } from '../../context/PremiumEntitlementContext';
import { getUserId } from '../../services/supabaseClient';
import { scaleIngredients } from '../../utils/scaleIngredients';
import { formatScaledIngredientQuantityDisplay } from '../../utils/formatScaledIngredientAmount';
import { showError, showSuccess } from '../../utils/appToast';
import { useInvalidateHomeList } from '../../hooks/useInvalidateHomeList';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../query/keys';
import { fetchRecipeDetailBundle, RECIPE_DETAIL_STALE_MS } from '../../query/recipeDetailBundle';
import type { HomeListBundle } from '../../query/homeListBundle';
import { invalidateMealsRange } from '../../query/invalidate';
import { getZoneOrderFromStore } from '../../utils/storeUtils';
import { ZONE_LABELS } from '../../data/zone';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';
import {
  RECIPE_CARD_GAP,
  recipeListSectionProps,
} from '../../design/recipeLayout';
import {
  AddRecipeToMealSheet,
  type AddRecipeToMealPayload,
} from '../../components/recipes/AddRecipeToMealSheet';

type Route = RouteProp<RecipesStackParamList, 'RecipeDetails'>;

export function RecipeDetailsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const invalidateHomeList = useInvalidateHomeList();
  const { isPremium, isPremiumLoading } = usePremiumEntitlement();
  const scrollBottomPad = scrollPaddingBottomWithoutTabBar(insets.bottom, theme.spacing);
  const navigation = useNavigation<NativeStackNavigationProp<RecipesStackParamList>>();
  const route = useRoute<Route>();
  const { recipeId } = route.params;
  const detailQuery = useQuery({
    queryKey: queryKeys.recipeDetail(recipeId),
    queryFn: () => fetchRecipeDetailBundle(recipeId),
    staleTime: RECIPE_DETAIL_STALE_MS,
  });
  const recipe = detailQuery.data?.recipe ?? null;
  const ingredients = React.useMemo(
    () => detailQuery.data?.ingredients ?? [],
    [detailQuery.data?.ingredients]
  );
  const [adding, setAdding] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [displayServings, setDisplayServings] = useState<number | null>(null);
  const [addToMealSheetVisible, setAddToMealSheetVisible] = useState(false);
  const [confirmingMeal, setConfirmingMeal] = useState(false);

  useEffect(() => {
    setDisplayServings(null);
  }, [recipeId]);

  useEffect(() => {
    if (detailQuery.isError) {
      showError('Could not load recipe.');
    }
  }, [detailQuery.isError]);

  const invalidateRecipeDetail = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.recipeDetail(recipeId) });
  }, [queryClient, recipeId]);

  const handleDuplicate = useCallback(async () => {
    const userId = await getUserId();
    if (!userId) return;
    try {
      const existing = isPremium ? [] : await getRecipes(userId);
      const allowed = await ensureFreeTierCapacity('recipe', existing.length, 1, isPremium, isPremiumLoading);
      if (!allowed) return;
      const newRecipe = await duplicateRecipe(recipeId, userId);
      navigation.replace('RecipeDetails', { recipeId: newRecipe.id });
    } catch {
      showError('Could not duplicate recipe.');
    }
  }, [recipeId, navigation, isPremium, isPremiumLoading]);

  const handleToggleFavorite = useCallback(async () => {
    try {
      await toggleRecipeFavorite(recipeId);
      const uid = await getUserId();
      if (uid) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.recipesScreenRoot(uid) });
      }
      invalidateRecipeDetail();
    } catch {
      showError('Could not update favorite.');
    }
  }, [recipeId, queryClient, invalidateRecipeDetail]);

  const baseServings = recipe?.servings ?? 4;
  const servings = displayServings ?? baseServings;
  const scaledIngredients = useMemo(
    () => (recipe ? scaleIngredients(ingredients, baseServings, servings) : []),
    [recipe, ingredients, baseServings, servings]
  );

  const handleShare = useCallback(() => {
    if (!recipe) return;
    const lines: string[] = [
      recipe.name,
      '',
      `${servings} servings`,
      '',
      'Ingredients:',
      ...scaledIngredients.map((i) =>
        i.quantity_value != null && i.quantity_unit
          ? `• ${i.name}: ${formatScaledIngredientQuantityDisplay(i.quantity_value, i.quantity_unit, i.name)}`
          : `• ${i.name}`
      ),
    ];
    const steps = parseRecipeInstructionSteps(recipe.instructions);
    if (steps.length > 0) {
      lines.push('', 'Instructions:');
      steps.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
    }
    if (recipe.recipe_url?.trim()) {
      lines.push('', recipe.recipe_url);
    }
    if (recipe.notes?.trim()) {
      lines.push('', 'Notes:', recipe.notes);
    }
    Share.share({ message: lines.join('\n'), title: recipe.name });
  }, [recipe, scaledIngredients, servings]);

  const pageHeader = (
    <PushedScreenHeader
      title="Recipe"
      onBack={() => navigation.goBack()}
      rightAccessory={
        recipe ? (
        <View style={styles.headerRight}>
          <HeaderIconButton
            accessibilityLabel={recipe.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
            onPress={handleToggleFavorite}
          >
            <Ionicons
              name={recipe.is_favorite ? 'heart' : 'heart-outline'}
              size={22}
              color={recipe.is_favorite ? theme.accent : theme.textSecondary}
            />
          </HeaderIconButton>
          <NativeContextMenu
            title="Recipe"
            isAnchoredToRight
            accessibilityLabel="More options"
            actions={[
              { id: 'share', label: 'Share recipe', systemImage: 'square.and.arrow.up', onPress: handleShare },
              { id: 'duplicate', label: 'Duplicate recipe', systemImage: 'plus.square.on.square', onPress: handleDuplicate },
              {
                id: 'delete',
                label: 'Delete recipe',
                systemImage: 'trash',
                destructive: true,
                onPress: () => setDeleteConfirmVisible(true),
              },
            ]}
          >
            <View style={styles.headerMenuButton}>
              <Ionicons name="ellipsis-horizontal" size={22} color={theme.textSecondary} />
            </View>
          </NativeContextMenu>
        </View>
        ) : undefined
      }
    />
  );

  const handleAddToList = async () => {
    const userId = await getUserId();
    if (!userId) return;
    setAdding(true);
    try {
      const baseServings = recipe?.servings ?? 4;
      const servings = displayServings ?? baseServings;
      const scaleFactor = baseServings > 0 ? servings / baseServings : 1;
      const bundle = queryClient.getQueryData<HomeListBundle>(queryKeys.homeList(userId));
      const store = bundle?.store ?? null;
      const zoneKeys = getZoneOrderFromStore(store);
      const zoneLabelsInOrder = zoneKeys.map((k) => ZONE_LABELS[k]);
      await addRecipeIngredientsToList(recipeId, userId, scaleFactor, {
        storeType: store?.store_type ?? 'generic',
        zoneLabelsInOrder,
      });
      await invalidateHomeList();
      invalidateRecipeDetail();
      showSuccess('Ingredients added to your list.');
    } catch {
      showError('Could not add ingredients to list.');
    } finally {
      setAdding(false);
    }
  };

  const handleConfirmAddToMeal = useCallback(
    async (payload: AddRecipeToMealPayload) => {
      const userId = await getUserId();
      if (!userId) return;
      setConfirmingMeal(true);
      try {
        const existingMeals = isPremium ? [] : await getMeals(userId);
        const allowed = await ensureFreeTierCapacity('meal', existingMeals.length, 1, isPremium, isPremiumLoading);
        if (!allowed) {
          setConfirmingMeal(false);
          return;
        }
        await addRecipeToMeals(recipeId, userId, {
          meal_date: payload.meal_date,
          meal_slot: payload.meal_slot,
          custom_slot_name: payload.custom_slot_name,
        });
        await invalidateMealsRange(queryClient, userId);
        await invalidateHomeList();
        setAddToMealSheetVisible(false);
        navigation.navigate('RecipesList');
        invalidateRecipeDetail();
      } catch {
        showError('Could not add to meals.');
      } finally {
        setConfirmingMeal(false);
      }
    },
    [recipeId, queryClient, navigation, invalidateRecipeDetail, invalidateHomeList, isPremium, isPremiumLoading]
  );

  const handleDelete = useCallback(async () => {
    setDeleteConfirmVisible(false);
    try {
      await deleteRecipe(recipeId);
      navigation.goBack();
    } catch {
      showError('Could not delete recipe.');
    }
  }, [recipeId, navigation]);

  if (detailQuery.isPending && !detailQuery.data) {
    return (
      <Screen padded safeTop={false} safeBottom={false}>
        {pageHeader}
        <View style={[styles.centered, { backgroundColor: theme.background }]}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      </Screen>
    );
  }

  if (!recipe) {
    return (
      <Screen padded safeTop={false} safeBottom={false}>
        {pageHeader}
        <View style={[styles.centered, { backgroundColor: theme.background }]}>
          <Text style={[theme.typography.body, { color: theme.textSecondary }]}>Recipe not found.</Text>
        </View>
      </Screen>
    );
  }

  const timeLabel = formatRecipeDurationMinutes(recipe.total_time_minutes);
  const detailPills: string[] = [];
  if (timeLabel) detailPills.push(timeLabel);
  detailPills.push(`${servings} servings`);
  detailPills.push(
    `${ingredients.length} ingredient${ingredients.length === 1 ? '' : 's'}`
  );
  if (recipe.category) {
    const cat = RECIPE_CATEGORY_LABELS[recipe.category];
    if (cat) detailPills.push(cat);
  }

  return (
    <Screen padded safeTop={false} safeBottom={false}>
      {pageHeader}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingBottom: scrollBottomPad,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[theme.typography.title2, { color: theme.textPrimary, marginBottom: theme.spacing.xs }]}>
          {recipe.name}
        </Text>

        <View style={styles.pillsBlock}>
          <RecipeMetaPills labels={detailPills} />
        </View>

        <Text style={[theme.typography.footnote, { color: theme.textSecondary, marginBottom: theme.spacing.xs }]}>
          Scale ingredient amounts for the number of servings you are cooking.
        </Text>

        <View
          style={[
            styles.servingsControl,
            {
              backgroundColor: theme.surface,
              borderColor: theme.divider,
              marginBottom: RECIPE_CARD_GAP,
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.servingsBtn, { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: theme.divider }]}
            onPress={() => setDisplayServings((s) => Math.max(1, (s ?? baseServings) - 1))}
            accessibilityRole="button"
            accessibilityLabel="Decrease servings"
          >
            <Ionicons name="remove" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.servingsValueBtn}
            onLongPress={() => setDisplayServings(null)}
            accessibilityRole="button"
            accessibilityLabel={`${servings} servings`}
            accessibilityHint="Hold to reset to default"
          >
            <Text style={[theme.typography.headline, styles.servingsValue, { color: theme.textPrimary }]}>
              {servings}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.servingsBtn, { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.divider }]}
            onPress={() => setDisplayServings((s) => (s ?? baseServings) + 1)}
            accessibilityRole="button"
            accessibilityLabel="Increase servings"
          >
            <Ionicons name="add" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>

        {recipe.recipe_url?.trim() ? (
          <TouchableOpacity
            style={[styles.linkRow, { marginBottom: RECIPE_CARD_GAP }]}
            onPress={() => Linking.openURL(recipe.recipe_url!)}
          >
            <Ionicons name="link" size={18} color={theme.accent} />
            <Text style={[theme.typography.body, { color: theme.accent, marginLeft: theme.spacing.sm }]}>
              Open recipe link
            </Text>
          </TouchableOpacity>
        ) : null}

        <ListSection title="Ingredients" {...recipeListSectionProps}>
          <IngredientList ingredients={scaledIngredients} showTitle={false} />
        </ListSection>

        <ListSection title="Instructions" {...recipeListSectionProps}>
          <RecipeInstructionsSection instructions={recipe.instructions} />
        </ListSection>

        {recipe.notes?.trim() ? (
          <ListSection title="Tips" {...recipeListSectionProps}>
            <Text style={[theme.typography.body, { color: theme.textPrimary }]}>{recipe.notes.trim()}</Text>
          </ListSection>
        ) : null}

        <RecipeActionStack>
          <PrimaryButton
            title="Add ingredients to list"
            onPress={handleAddToList}
            loading={adding}
            disabled={ingredients.length === 0}
          />
          <SecondaryButton
            title="Add to meals"
            onPress={() => setAddToMealSheetVisible(true)}
          />
          <SecondaryButton
            title="Edit recipe"
            onPress={() => navigation.navigate('RecipeEdit', { recipeId })}
          />
        </RecipeActionStack>
      </ScrollView>

      <AddRecipeToMealSheet
        visible={addToMealSheetVisible}
        onClose={() => setAddToMealSheetVisible(false)}
        recipeName={recipe.name}
        loading={confirmingMeal}
        onConfirm={handleConfirmAddToMeal}
      />

      <AppConfirmationDialog
        visible={deleteConfirmVisible}
        onClose={() => setDeleteConfirmVisible(false)}
        title="Delete recipe?"
        message="This cannot be undone."
        buttons={[
          { label: 'Cancel', cancel: true, onPress: () => setDeleteConfirmVisible(false) },
          { label: 'Delete', destructive: true, onPress: handleDelete },
        ]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  servingsControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    borderRadius: radius.input,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pillsBlock: {
    marginBottom: spacing.base,
  },
  servingsBtn: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  servingsValueBtn: {
    flex: 2,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  servingsValue: {
    textAlign: 'center',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerMenuButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
