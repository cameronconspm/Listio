/**
 * Central query keys for invalidation and cache lookups.
 * Expand as screens migrate from local `useState` + `load()` to `useQuery`.
 */
export const queryKeys = {
  root: ['listio'] as const,
  /** Home tab: list items + default store + all stores (see `fetchHomeListBundle`). */
  homeList: (userId: string, listId: string) =>
    [...queryKeys.root, 'homeList', userId, listId] as const,
  /** Invalidate every cached shopping list for a user. */
  homeListAll: (userId: string) => [...queryKeys.root, 'homeList', userId] as const,
  listItems: (userId: string) => [...queryKeys.root, 'listItems', userId] as const,
  stores: (userId: string) => [...queryKeys.root, 'stores', userId] as const,
  meals: (userId: string) => [...queryKeys.root, 'meals', userId] as const,
  recipes: (userId: string) => [...queryKeys.root, 'recipes', userId] as const,
  /** Recipes tab: filter + sort-specific bundle (see `fetchRecipesScreenBundle`). */
  recipesScreenRoot: (userId: string) => [...queryKeys.root, 'recipesScreen', userId] as const,
  recipesScreen: (userId: string, filter: string, sort: string) =>
    [...queryKeys.recipesScreenRoot(userId), filter, sort] as const,
  /** Ingredient names keyed by recipe id, used only when searching in the Recipes tab. */
  recipeIngredientNamesForSearch: (userId: string) =>
    [...queryKeys.root, 'recipeIngredientNamesForSearch', userId] as const,
  mealsRangeRoot: (userId: string) => [...queryKeys.root, 'mealsRange', userId] as const,
  mealsRange: (userId: string, rangeStart: string, rangeEnd: string) =>
    [...queryKeys.mealsRangeRoot(userId), rangeStart, rangeEnd] as const,
  recipeDetail: (recipeId: string) => [...queryKeys.root, 'recipeDetail', recipeId] as const,
  mealDetail: (userId: string, mealId: string) => [...queryKeys.root, 'mealDetail', userId, mealId] as const,
  /** Settings → Share list: members, invites, and owner share toggles. */
  shareList: (userId: string) => [...queryKeys.root, 'shareList', userId] as const,
  /** List tab switcher: shopping lists + active list id. */
  shoppingLists: (userId: string) => [...queryKeys.root, 'shoppingLists', userId] as const,
  /** Compact meal labels for list rows (keyed by sorted linked meal id signature). */
  linkedMealLabels: (userId: string, listId: string, mealIdsSignature: string) =>
    [...queryKeys.root, 'linkedMealLabels', userId, listId, mealIdsSignature] as const,
} as const;
