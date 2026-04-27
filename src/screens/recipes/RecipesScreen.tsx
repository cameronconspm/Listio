import React, { useState, useCallback, useLayoutEffect, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useQueryClient, keepPreviousData, useIsRestoring } from '@tanstack/react-query';
import { createAnimatedComponent } from 'react-native-reanimated';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RecipesStackParamList } from '../../navigation/types';
import { useTheme } from '../../design/ThemeContext';
import { tabScrollPaddingTopBelowHeader } from '../../design/layout';
import { useNavigationChromeScroll } from '../../navigation/NavigationChromeScrollContext';
import { FAB_CLEARANCE, useFabExpandScrollHandler } from '../../hooks/useFabExpandScrollHandler';
import { RecipeCard } from '../../components/recipes/RecipeCard';
import { RecipeFilterRow } from '../../components/recipes/RecipeFilterRow';
import { RecipesHeader } from '../../components/recipes/RecipesHeader';
import { SimpleTabHeader } from '../../components/ui/SimpleTabHeader';
import {
  RecipeSortSheet,
  RECIPE_SORT_LABELS,
} from '../../components/recipes/RecipeSortSheet';
import { Screen } from '../../components/ui/Screen';
import { FloatingAddButton } from '../../components/ui/FloatingAddButton';
import { EmptyState } from '../../components/ui/EmptyState';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { AppConfirmationDialog } from '../../components/ui/AppConfirmationDialog';
import { useAuthUserId } from '../../context/AuthUserIdContext';
import {
  toggleRecipeFavorite,
  deleteRecipe,
  type RecipeFilter,
  type RecipeSortKey,
} from '../../services/recipeService';
import type { Recipe } from '../../types/models';
import { fetchUserPreferences, patchUserPreferencesIfSync } from '../../services/userPreferencesService';
import { useDebounce } from '../../hooks/useDebounce';
import { showError } from '../../utils/appToast';
import { queryKeys } from '../../query/keys';
import { fetchRecipesScreenBundle, RECIPES_SCREEN_STALE_MS } from '../../query/recipesScreenBundle';
import { useLazyMount } from '../../hooks/useLazyMount';
import { getRecipeIngredientNamesByRecipeIds, searchRecipeIds } from '../../services/recipeService';
import { mapToRecord } from '../../utils/mapToJson';
import { isSyncEnabled } from '../../services/supabaseClient';
import { fetchRecipeDetailBundle, RECIPE_DETAIL_STALE_MS } from '../../query/recipeDetailBundle';

const AnimatedFlatList = createAnimatedComponent(FlatList<Recipe>);

const RECIPE_FILTER_IDS = new Set<string>([
  'all',
  'favorites',
  'recent',
  'breakfast',
  'lunch',
  'dinner',
  'dessert',
  'snack',
]);
const RECIPE_SORT_IDS = new Set<string>([
  'updated_at',
  'created_at',
  'name',
  'servings',
  'ingredient_count',
]);

function coerceRecipeFilter(v: string | undefined): RecipeFilter | null {
  if (!v || !RECIPE_FILTER_IDS.has(v)) return null;
  return v as RecipeFilter;
}

function coerceRecipeSort(v: string | undefined): RecipeSortKey | null {
  if (!v || !RECIPE_SORT_IDS.has(v)) return null;
  return v as RecipeSortKey;
}

const EMPTY_NAMES_BY_RECIPE_ID: Record<string, string[]> = {};

const FILTERED_EMPTY_MESSAGES: Record<string, string> = {
  favorites: 'No favorite recipes yet',
  breakfast: 'No breakfast recipes yet',
  lunch: 'No lunch recipes yet',
  dinner: 'No dinner recipes yet',
  dessert: 'No dessert recipes yet',
  snack: 'No snack recipes yet',
  recent: 'No recent recipes',
};

export function RecipesScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const headerHeight = useHeaderHeight();
  const scrollContentPaddingTop = tabScrollPaddingTopBelowHeader(headerHeight, theme.spacing);
  const insets = useSafeAreaInsets();
  const { scrollY } = useNavigationChromeScroll();
  const recipesScrollShared = scrollY.RecipesStack;
  const { fabExpandProgress, listScrollHandler } = useFabExpandScrollHandler(recipesScrollShared);
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NativeStackNavigationProp<RecipesStackParamList>>();
  const userId = useAuthUserId();
  const [screenFocused, setScreenFocused] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<RecipeFilter>('all');
  const [sort, setSort] = useState<RecipeSortKey>('updated_at');
  const [sortSheetVisible, setSortSheetVisible] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const sortSheetMounted = useLazyMount(sortSheetVisible);
  const deleteDialogMounted = useLazyMount(deleteTargetId != null);
  const [searchQuery, setSearchQuery] = useState('');

  const recipesPrefsLoaded = useRef(false);

  const userReady = typeof userId === 'string' && userId.length > 0;

  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      return () => setScreenFocused(false);
    }, [])
  );

  const isRestoringCache = useIsRestoring();

  const recipesQuery = useQuery({
    queryKey: queryKeys.recipesScreen(userId ?? '', filter, sort),
    queryFn: () => fetchRecipesScreenBundle(userId!, filter, sort),
    enabled: screenFocused && userReady,
    staleTime: RECIPES_SCREEN_STALE_MS,
    placeholderData: keepPreviousData,
  });

  const bundle = recipesQuery.data;
  const recipes = React.useMemo(() => bundle?.recipes ?? [], [bundle?.recipes]);
  const allRecipesCount = bundle?.allRecipesCount ?? 0;
  const ingredientCounts = bundle?.ingredientCounts ?? {};

  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setDebouncedSearchQuery('');
      return;
    }
    const t = setTimeout(() => setDebouncedSearchQuery(trimmed), 200);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const recipeIdsForNames = React.useMemo(() => recipes.map((r) => r.id), [recipes]);

  const syncEnabled = isSyncEnabled();

  /**
   * Server-side tsvector search (migration 029): returns recipe ids matching
   * `query` across recipe names + ingredient names. When sync is enabled we
   * rely on this entirely; local-only mode falls back to the ingredient-name
   * query below.
   */
  const searchIdsQuery = useQuery({
    queryKey: [...queryKeys.recipeIngredientNamesForSearch(userId ?? ''), 'rpc', debouncedSearchQuery],
    queryFn: () => searchRecipeIds(debouncedSearchQuery),
    enabled: syncEnabled && userReady && debouncedSearchQuery.length > 0,
    staleTime: 30_000,
  });

  const ingredientNamesQuery = useQuery({
    queryKey: queryKeys.recipeIngredientNamesForSearch(userId ?? ''),
    queryFn: async () => {
      if (recipeIdsForNames.length === 0) return {} as Record<string, string[]>;
      const namesMap = await getRecipeIngredientNamesByRecipeIds(recipeIdsForNames);
      return mapToRecord(namesMap);
    },
    enabled:
      !syncEnabled &&
      userReady &&
      debouncedSearchQuery.length > 0 &&
      recipeIdsForNames.length > 0,
    staleTime: RECIPES_SCREEN_STALE_MS,
  });

  const namesByRecipeIdForSearch = ingredientNamesQuery.data ?? EMPTY_NAMES_BY_RECIPE_ID;
  const searchIdSet = searchIdsQuery.data ?? null;

  const listInitialLoad =
    userReady &&
    screenFocused &&
    recipesQuery.data === undefined &&
    (recipesQuery.isPending || isRestoringCache);

  const trueEmpty = !listInitialLoad && allRecipesCount === 0;

  useEffect(() => {
    if (recipesQuery.isError) {
      showError('Could not load recipes.');
    }
  }, [recipesQuery.isError]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = await fetchUserPreferences();
      if (cancelled) return;
      const cf = coerceRecipeFilter(p.recipesUi?.filter);
      const cs = coerceRecipeSort(p.recipesUi?.sort);
      if (cf) setFilter(cf);
      if (cs) setSort(cs);
      recipesPrefsLoaded.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const debouncedPersistRecipesUi = useDebounce(() => {
    if (!recipesPrefsLoaded.current) return;
    patchUserPreferencesIfSync({
      recipesUi: { filter, sort },
    });
  }, 500);

  useEffect(() => {
    debouncedPersistRecipesUi();
  }, [filter, sort, debouncedPersistRecipesUi]);

  const refetchRecipes = useCallback(() => {
    if (!userReady) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.recipesScreenRoot(userId) });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.recipeIngredientNamesForSearch(userId!),
    });
  }, [queryClient, userId, userReady]);

  const prefetchRecipeDetail = useCallback(
    (id: string) => {
      void queryClient.prefetchQuery({
        queryKey: queryKeys.recipeDetail(id),
        queryFn: () => fetchRecipeDetailBundle(id),
        staleTime: RECIPE_DETAIL_STALE_MS,
      });
    },
    [queryClient]
  );

  useLayoutEffect(() => {
    const simpleHeader = listInitialLoad || trueEmpty;
    navigation.setOptions({
      header: () =>
        simpleHeader ? (
          <SimpleTabHeader tabKey="RecipesStack" />
        ) : (
          <RecipesHeader searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        ),
    });
  }, [navigation, listInitialLoad, trueEmpty, searchQuery]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void recipesQuery.refetch().finally(() => setRefreshing(false));
  }, [recipesQuery]);

  const handleFavorite = useCallback(
    async (recipeId: string) => {
      try {
        await toggleRecipeFavorite(recipeId);
        refetchRecipes();
      } catch {
        showError('Could not update favorite.');
      }
    },
    [refetchRecipes]
  );

  const handleDelete = useCallback((recipeId: string) => {
    setDeleteTargetId(recipeId);
  }, []);

  const openRecipeDetail = useCallback(
    (id: string) => {
      prefetchRecipeDetail(id);
      navigation.navigate('RecipeDetails', { recipeId: id });
    },
    [navigation, prefetchRecipeDetail]
  );

  const openRecipeEdit = useCallback(
    (id: string) => {
      navigation.navigate('RecipeEdit', { recipeId: id });
    },
    [navigation]
  );

  const confirmDelete = useCallback(async () => {
    const id = deleteTargetId;
    setDeleteTargetId(null);
    if (!id) return;
    try {
      await deleteRecipe(id);
      queryClient.removeQueries({ queryKey: queryKeys.recipeDetail(id) });
      refetchRecipes();
    } catch {
      showError('Could not delete recipe.');
    }
  }, [deleteTargetId, queryClient, refetchRecipes]);

  const visibleRecipes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return recipes;
    const debouncedActive =
      debouncedSearchQuery.length > 0 && debouncedSearchQuery.toLowerCase() === q;
    if (syncEnabled) {
      // Prefer server-side tsvector results once the debounce has settled.
      if (debouncedActive && searchIdSet) {
        return recipes.filter((r) => searchIdSet.has(r.id) || r.name.toLowerCase().includes(q));
      }
      return recipes.filter((r) => r.name.toLowerCase().includes(q));
    }
    return recipes.filter((r) => {
      if (r.name.toLowerCase().includes(q)) return true;
      if (!debouncedActive) return false;
      const names = namesByRecipeIdForSearch[r.id];
      if (!names?.length) return false;
      return names.some((n) => n.toLowerCase().includes(q));
    });
  }, [recipes, searchQuery, debouncedSearchQuery, namesByRecipeIdForSearch, searchIdSet, syncEnabled]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        list: { flex: 1, overflow: 'visible' },
        paddedBody: {
          flex: 1,
          paddingHorizontal: theme.spacing.md,
        },
        listContent: {
          paddingBottom: 100,
        },
        sortRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: theme.spacing.xs,
          paddingHorizontal: 0,
          marginTop: theme.spacing.xs,
          marginBottom: theme.spacing.xs,
        },
        sortTouchable: {
          paddingVertical: 4,
          paddingHorizontal: 4,
        },
        centeredLoader: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 280,
        },
      }),
    [theme],
  );

  const filteredEmpty = !trueEmpty && recipes.length === 0;
  const searchNoMatches =
    !trueEmpty && recipes.length > 0 && visibleRecipes.length === 0 && searchQuery.trim().length > 0;

  const fabBottom = tabBarHeight + Math.max(insets.bottom, theme.spacing.sm) + theme.spacing.sm;
  const listContentBottomPad = fabBottom + FAB_CLEARANCE + theme.spacing.sm;

  const listHeader = useMemo(
    () => (
      <View>
        <RecipeFilterRow filter={filter} onFilterChange={setFilter} />
        <View style={styles.sortRow}>
          <Text style={[theme.typography.footnote, { color: theme.textSecondary }]}>
            {visibleRecipes.length} {visibleRecipes.length === 1 ? 'recipe' : 'recipes'}
          </Text>
          <TouchableOpacity
            onPress={() => setSortSheetVisible(true)}
            style={styles.sortTouchable}
            activeOpacity={0.7}
          >
            <Text style={[theme.typography.footnote, { color: theme.accent }]}>
              Sort: {RECIPE_SORT_LABELS[sort]}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    ),
    [
      filter,
      sort,
      theme.accent,
      theme.textSecondary,
      theme.typography.footnote,
      visibleRecipes.length,
      styles.sortRow,
      styles.sortTouchable,
    ]
  );

  if (userId === undefined || listInitialLoad) {
    return (
      <Screen padded={false} safeTop={false} safeBottom={false}>
        <View style={[styles.centeredLoader, { paddingTop: scrollContentPaddingTop }]}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      </Screen>
    );
  }

  if (trueEmpty) {
    return (
      <Screen padded={false} safeTop={false} safeBottom={false}>
        <View style={[styles.paddedBody, { paddingTop: scrollContentPaddingTop }]}>
        <RecipeSortSheet
          visible={sortSheetVisible}
          onClose={() => setSortSheetVisible(false)}
          value={sort}
          onSelect={setSort}
        />
        <EmptyState
          icon="book-outline"
          title="No recipes yet"
          message="Save your go-to meals and reuse them any time."
          glass={false}
        >
          <PrimaryButton
            title="Create your first recipe"
            onPress={() => navigation.navigate('RecipeEdit', {})}
          />
        </EmptyState>
        <AppConfirmationDialog
          visible={!!deleteTargetId}
          onClose={() => setDeleteTargetId(null)}
          title="Delete recipe?"
          message="This cannot be undone."
          buttons={[
            { label: 'Cancel', cancel: true, onPress: () => setDeleteTargetId(null) },
            { label: 'Delete', destructive: true, onPress: confirmDelete },
          ]}
        />
        </View>
      </Screen>
    );
  }

  if (filteredEmpty) {
    return (
      <Screen padded={false} safeTop={false} safeBottom={false}>
        <View style={[styles.paddedBody, { paddingTop: scrollContentPaddingTop }]}>
        <RecipeFilterRow filter={filter} onFilterChange={setFilter} />
        <View style={styles.sortRow}>
          <Text style={[theme.typography.footnote, { color: theme.textSecondary }]}>
            {visibleRecipes.length} {visibleRecipes.length === 1 ? 'recipe' : 'recipes'}
          </Text>
          <TouchableOpacity
            onPress={() => setSortSheetVisible(true)}
            style={styles.sortTouchable}
            activeOpacity={0.7}
          >
            <Text style={[theme.typography.footnote, { color: theme.accent }]}>
              Sort: {RECIPE_SORT_LABELS[sort]}
            </Text>
          </TouchableOpacity>
        </View>
        <RecipeSortSheet
          visible={sortSheetVisible}
          onClose={() => setSortSheetVisible(false)}
          value={sort}
          onSelect={setSort}
        />
        <EmptyState
          icon="book-outline"
          title={FILTERED_EMPTY_MESSAGES[filter] ?? 'No recipes match'}
          message="Try a different filter or create a new recipe."
          glass={false}
        >
          <PrimaryButton
            title="Create recipe"
            onPress={() => navigation.navigate('RecipeEdit', {})}
          />
        </EmptyState>
        <AppConfirmationDialog
          visible={!!deleteTargetId}
          onClose={() => setDeleteTargetId(null)}
          title="Delete recipe?"
          message="This cannot be undone."
          buttons={[
            { label: 'Cancel', cancel: true, onPress: () => setDeleteTargetId(null) },
            { label: 'Delete', destructive: true, onPress: confirmDelete },
          ]}
        />
        <FloatingAddButton
          onPress={() => navigation.navigate('RecipeEdit', {})}
          expandProgress={fabExpandProgress}
          bottom={fabBottom}
          addLabel="Add Recipe"
          accessibilityHint="Opens the recipe editor"
        />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} safeTop={false} safeBottom={false}>
      {sortSheetMounted ? (
        <RecipeSortSheet
          visible={sortSheetVisible}
          onClose={() => setSortSheetVisible(false)}
          value={sort}
          onSelect={setSort}
        />
      ) : null}
      <AnimatedFlatList
        style={styles.list}
        data={visibleRecipes}
        keyExtractor={(r) => r.id}
        ListHeaderComponent={listHeader}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior={Platform.OS === 'ios' ? 'never' : undefined}
        onScroll={listScrollHandler}
        scrollEventThrottle={16}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={9}
        removeClippedSubviews={Platform.OS === 'android'}
        renderItem={({ item }) => (
          <RenderRecipeCard
            recipe={item}
            ingredientCount={ingredientCounts[item.id] ?? 0}
            onOpen={openRecipeDetail}
            onFavorite={handleFavorite}
            onEdit={openRecipeEdit}
            onDelete={handleDelete}
          />
        )}
        ListEmptyComponent={
          searchNoMatches ? (
            <EmptyState
              icon="search-outline"
              title="No matches"
              message="Try another name or ingredient, or clear the search field."
              glass={false}
            />
          ) : null
        }
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: scrollContentPaddingTop,
            paddingBottom: listContentBottomPad,
            paddingHorizontal: theme.spacing.md,
          },
          searchNoMatches && { flexGrow: 1 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.accent}
          />
        }
      />
      {deleteDialogMounted ? (
        <AppConfirmationDialog
          visible={!!deleteTargetId}
          onClose={() => setDeleteTargetId(null)}
          title="Delete recipe?"
          message="This cannot be undone."
          buttons={[
            { label: 'Cancel', cancel: true, onPress: () => setDeleteTargetId(null) },
            { label: 'Delete', destructive: true, onPress: confirmDelete },
          ]}
        />
      ) : null}
      <FloatingAddButton
        onPress={() => navigation.navigate('RecipeEdit', {})}
        expandProgress={fabExpandProgress}
        bottom={fabBottom}
        addLabel="Add Recipe"
        accessibilityHint="Opens the recipe editor"
      />
    </Screen>
  );
}

type RenderRecipeCardProps = {
  recipe: Recipe;
  ingredientCount: number;
  onOpen: (id: string) => void;
  onFavorite: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
};

/** Wraps `RecipeCard` with stable per-id callbacks so the memo holds across
 *  unrelated parent re-renders (e.g. search typing, scroll). */
const RenderRecipeCard = React.memo(function RenderRecipeCard({
  recipe,
  ingredientCount,
  onOpen,
  onFavorite,
  onEdit,
  onDelete,
}: RenderRecipeCardProps) {
  const id = recipe.id;
  const handlePress = useCallback(() => onOpen(id), [onOpen, id]);
  const handleFavorite = useCallback(() => onFavorite(id), [onFavorite, id]);
  const handleEdit = useCallback(() => onEdit(id), [onEdit, id]);
  const handleDelete = useCallback(() => onDelete(id), [onDelete, id]);
  return (
    <RecipeCard
      recipe={recipe}
      ingredientCount={ingredientCount}
      onPress={handlePress}
      onFavorite={handleFavorite}
      onEdit={handleEdit}
      onDelete={handleDelete}
    />
  );
});
