import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Keyboard,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MealsStackParamList } from '../../navigation/types';
import { useTheme } from '../../design/ThemeContext';
import { scrollPaddingBottomWithoutTabBar } from '../../design/layout';
import { Screen } from '../../components/ui/Screen';
import { PushedScreenHeader } from '../../components/ui/PushedScreenHeader';
import { KeyboardSafeForm } from '../../components/ui/KeyboardSafeForm';
import { ListSection } from '../../components/ui/ListSection';
import { TextField } from '../../components/ui/TextField';
import { AppDateField } from '../../components/ui/AppDateField';
import { AppSelectField } from '../../components/ui/AppSelectField';
import { UnitPickerSheet } from '../../components/ui/UnitPickerSheet';
import { normalizeUnitValue } from '../../components/ui/unitSelection';
import { AppConfirmationDialog } from '../../components/ui/AppConfirmationDialog';
import { RecipeSearchBar } from '../../components/recipes/RecipeSearchBar';
import { MealRepeatSheet } from '../../components/meals/MealRepeatSheet';
import { RECIPE_CATEGORY_LABELS } from '../../components/recipes/RecipeCategorySheet';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthUserId } from '../../context/AuthContext';
import { invalidateMealsRange } from '../../query/invalidate';
import { queryKeys } from '../../query/keys';
import { fetchMealDetailBundle, MEAL_DETAIL_STALE_MS } from '../../query/mealDetailBundle';
import { fetchRecipeDetailBundle, RECIPE_DETAIL_STALE_MS } from '../../query/recipeDetailBundle';
import { fetchRecipesScreenBundle, RECIPES_SCREEN_STALE_MS } from '../../query/recipesScreenBundle';
import { createMeal, getMeals, setMealIngredients, updateMeal } from '../../services/mealService';
import { ensureFreeTierCapacity } from '../../services/freeTierLimits';
import { usePremiumEntitlement } from '../../context/PremiumEntitlementContext';
import { showError } from '../../utils/appToast';
import { notifyFreeTierNearLimitIfNeeded } from '../../services/notifyFreeTierNearLimit';
import { normalize } from '../../utils/normalize';
import {
  expandMealRepeatDates,
  type MealRepeatMode,
  toDateString,
} from '../../utils/dateUtils';
import { titleCaseWords } from '../../utils/titleCaseWords';
import type { MealSlot, Recipe } from '../../types/models';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';
import { recipeListSectionProps } from '../../design/recipeLayout';
import { notifyMealSavedForMilestones } from '../../firstLaunchTour/milestoneUnlockFlow';

type Route = RouteProp<MealsStackParamList, 'MealEdit'>;

const VALID_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'dessert', 'custom'];

function toMealSlot(s: string | undefined): MealSlot {
  return s && VALID_SLOTS.includes(s as MealSlot) ? (s as MealSlot) : 'dinner';
}

type IngredientRow = {
  name: string;
  quantity_value: string;
  quantity_unit: string;
  notes: string;
  brand_preference: string;
};

const defaultIngredient: IngredientRow = {
  name: '',
  quantity_value: '',
  quantity_unit: 'ea',
  notes: '',
  brand_preference: '',
};

const MIN_TOUCH_TARGET = 44;
const ROW_LABEL_W = 88;
const fieldFlush = { marginBottom: 0, flex: 1, minWidth: 0 } as const;

const MEAL_REPEAT_LABELS: Record<MealRepeatMode, string> = {
  never: 'Never',
  daily: 'Daily',
  weekly: 'Weekly',
  weekdays: 'Weekdays',
};

type MealSlotChip = {
  key: string;
  slot: MealSlot;
  /** When slot is custom, preset label for the custom slot (e.g. Snack). */
  customPreset?: string;
  label: string;
};

const MEAL_SLOT_CHIPS: MealSlotChip[] = [
  { key: 'breakfast', slot: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', slot: 'lunch', label: 'Lunch' },
  { key: 'dinner', slot: 'dinner', label: 'Dinner' },
  { key: 'snack', slot: 'custom', customPreset: 'Snack', label: 'Snack' },
  { key: 'dessert', slot: 'dessert', label: 'Dessert' },
];

function formatRecipeMetaLine(recipe: Pick<Recipe, 'servings' | 'total_time_minutes' | 'category'>): string {
  const parts: string[] = [];
  if (recipe.servings != null && recipe.servings > 0) {
    parts.push(`${recipe.servings} serving${recipe.servings === 1 ? '' : 's'}`);
  }
  if (recipe.total_time_minutes != null && recipe.total_time_minutes > 0) {
    parts.push(`${recipe.total_time_minutes} min`);
  }
  if (recipe.category) {
    parts.push(RECIPE_CATEGORY_LABELS[recipe.category] ?? recipe.category);
  }
  return parts.join(' · ');
}

function chipSelected(chip: MealSlotChip, mealSlot: MealSlot, customSlotName: string): boolean {
  if (chip.slot === 'custom' && chip.customPreset) {
    return (
      mealSlot === 'custom' && customSlotName.trim().toLowerCase() === chip.customPreset.toLowerCase()
    );
  }
  return mealSlot === chip.slot && chip.slot !== 'custom';
}

export function MealEditScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { isPremium, isPremiumLoading } = usePremiumEntitlement();
  const insets = useSafeAreaInsets();
  const scrollBottomPad = scrollPaddingBottomWithoutTabBar(insets.bottom, theme.spacing);
  const navigation = useNavigation<NativeStackNavigationProp<MealsStackParamList>>();
  const route = useRoute<Route>();
  const { mealId, preFillDate, preFillSlot, preFillCustomSlotName } = route.params ?? {};
  const isNew = !mealId;

  const [name, setName] = useState('');
  const [mealDate, setMealDate] = useState(preFillDate ?? toDateString(new Date()));
  const [mealSlot, setMealSlot] = useState<MealSlot>(() => toMealSlot(preFillSlot));
  const [customSlotName, setCustomSlotName] = useState(preFillCustomSlotName ?? '');
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [selectedRecipePreview, setSelectedRecipePreview] = useState<Recipe | null>(null);
  const [notes, setNotes] = useState('');
  const [ingredients, setIngredients] = useState<IngredientRow[]>([{ ...defaultIngredient }]);
  const [saving, setSaving] = useState(false);
  const [repeatMode, setRepeatMode] = useState<MealRepeatMode>('never');
  const [repeatSheetVisible, setRepeatSheetVisible] = useState(false);
  const [recipeSearchQuery, setRecipeSearchQuery] = useState('');
  const [recipeSearchFocused, setRecipeSearchFocused] = useState(false);
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);
  const [unitPickerIdx, setUnitPickerIdx] = useState<number | null>(null);

  const lastHydratedMealIdRef = useRef<string | null>(null);
  const lastHydratedRecipeIngredientsRef = useRef<string | null>(null);
  /** When false on edit, do not replace meal ingredients with the linked recipe's list (preserve saved rows). */
  const userSelectedRecipeThisSessionRef = useRef(false);
  const recipeSearchInputRef = useRef<TextInput>(null);
  const recipeSearchBlurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chipScrollRef = useRef<ScrollView>(null);

  const userId = useAuthUserId();
  const userReady = typeof userId === 'string' && userId.length > 0;
  const headerTitle = isNew ? 'Add meal' : 'Edit meal';

  const [debouncedRecipeSearch, setDebouncedRecipeSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedRecipeSearch(recipeSearchQuery), 200);
    return () => clearTimeout(t);
  }, [recipeSearchQuery]);

  const recipesPickerQuery = useQuery({
    queryKey: queryKeys.recipesScreenRoot(userId ?? ''),
    queryFn: () => fetchRecipesScreenBundle(userId!, 'all', 'updated_at'),
    enabled: Boolean(userReady),
    staleTime: RECIPES_SCREEN_STALE_MS,
  });

  const recipeDetailQuery = useQuery({
    queryKey: queryKeys.recipeDetail(selectedRecipeId ?? ''),
    queryFn: () => fetchRecipeDetailBundle(selectedRecipeId!),
    enabled: Boolean(selectedRecipeId),
    staleTime: RECIPE_DETAIL_STALE_MS,
  });

  const detailQuery = useQuery({
    queryKey: queryKeys.mealDetail(userId ?? '', mealId ?? ''),
    queryFn: () => fetchMealDetailBundle(userId!, mealId!),
    enabled: Boolean(!isNew && mealId && userReady),
    staleTime: MEAL_DETAIL_STALE_MS,
  });

  const filteredPickerRecipes = useMemo(() => {
    const list = recipesPickerQuery.data?.recipes ?? [];
    const q = debouncedRecipeSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) => r.name.toLowerCase().includes(q));
  }, [recipesPickerQuery.data?.recipes, debouncedRecipeSearch]);

  const displayRecipeForRow = useMemo(() => {
    if (selectedRecipePreview) return selectedRecipePreview;
    const r = recipeDetailQuery.data?.recipe;
    if (r && selectedRecipeId && r.id === selectedRecipeId) return r;
    return null;
  }, [selectedRecipePreview, recipeDetailQuery.data?.recipe, selectedRecipeId]);

  useEffect(() => {
    lastHydratedMealIdRef.current = null;
  }, [mealId]);

  useEffect(() => {
    if (isNew || !mealId || !detailQuery.data) return;
    if (lastHydratedMealIdRef.current === mealId) return;
    lastHydratedMealIdRef.current = mealId;
    const { meal, ingredients: ings } = detailQuery.data;
    setName(meal.name);
    setMealDate(meal.meal_date);
    setMealSlot(meal.meal_slot);
    setCustomSlotName(meal.custom_slot_name ?? '');
    setNotes(meal.notes ?? '');
    setSelectedRecipeId(meal.recipe_id ?? null);
    setSelectedRecipePreview(null);
    lastHydratedRecipeIngredientsRef.current = null;
    userSelectedRecipeThisSessionRef.current = false;
    setIngredients(
      ings.length > 0
        ? ings.map((i) => ({
            name: i.name,
            quantity_value: i.quantity_value != null ? String(i.quantity_value) : '',
            quantity_unit: i.quantity_unit ?? 'ea',
            notes: i.notes ?? '',
            brand_preference: i.brand_preference ?? '',
          }))
        : [{ ...defaultIngredient }]
    );
  }, [isNew, mealId, detailQuery.data]);

  useEffect(() => {
    if (!isNew && userReady && detailQuery.isError) {
      showError('Could not load meal.');
    }
  }, [isNew, userReady, detailQuery.isError]);

  useEffect(() => {
    return () => {
      if (recipeSearchBlurTimerRef.current) clearTimeout(recipeSearchBlurTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (preFillSlot) setMealSlot(toMealSlot(preFillSlot));
    if (preFillCustomSlotName) {
      setMealSlot('custom');
      setCustomSlotName(preFillCustomSlotName);
    }
    if (preFillDate) {
      setMealDate(preFillDate);
    }
  }, [preFillDate, preFillSlot, preFillCustomSlotName]);

  /** Scroll the meal type chip row so the pre-selected chip is always visible. */
  useEffect(() => {
    const selectedIdx = MEAL_SLOT_CHIPS.findIndex((c) => chipSelected(c, mealSlot, customSlotName));
    if (selectedIdx < 0 || !chipScrollRef.current) return;
    const chipStride = spacing.md * 2 + spacing.sm + 60;
    chipScrollRef.current.scrollTo({
      x: Math.max(0, selectedIdx * chipStride - spacing.md),
      animated: false,
    });
  // Run once on mount to position the strip; subsequent selection changes are visible inline.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedRecipeId || !recipeDetailQuery.data) return;
    if (!isNew && !userSelectedRecipeThisSessionRef.current) return;
    if (lastHydratedRecipeIngredientsRef.current === selectedRecipeId) return;
    lastHydratedRecipeIngredientsRef.current = selectedRecipeId;
    const ings = recipeDetailQuery.data.ingredients;
    setIngredients(
      ings.length > 0
        ? ings.map((i) => ({
            name: i.name,
            quantity_value: i.quantity_value != null ? String(i.quantity_value) : '',
            quantity_unit: i.quantity_unit ?? 'ea',
            notes: i.notes ?? '',
            brand_preference: '',
          }))
        : [{ ...defaultIngredient }]
    );
  }, [isNew, selectedRecipeId, recipeDetailQuery.data]);

  const addIngredient = () => {
    setIngredients((prev) => [...prev, { ...defaultIngredient }]);
  };

  const removeIngredient = (idx: number) => {
    setIngredients((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length > 0 ? next : [{ ...defaultIngredient }];
    });
  };

  const updateIngredient = (idx: number, field: keyof IngredientRow, value: string) => {
    setIngredients((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const clearRecipeSelection = useCallback(() => {
    setSelectedRecipeId(null);
    setSelectedRecipePreview(null);
    lastHydratedRecipeIngredientsRef.current = null;
    userSelectedRecipeThisSessionRef.current = false;
    setIngredients([{ ...defaultIngredient }]);
    setName('');
    setRecipeSearchQuery('');
    setRecipeSearchFocused(false);
  }, []);

  const beginRecipeSearch = useCallback(() => {
    setSelectedRecipeId(null);
    setSelectedRecipePreview(null);
    lastHydratedRecipeIngredientsRef.current = null;
    userSelectedRecipeThisSessionRef.current = false;
    setIngredients([{ ...defaultIngredient }]);
    setName('');
    setRecipeSearchQuery('');
    setRecipeSearchFocused(true);
    requestAnimationFrame(() => recipeSearchInputRef.current?.focus());
  }, []);

  const onRecipeSearchFocus = useCallback(() => {
    if (recipeSearchBlurTimerRef.current) {
      clearTimeout(recipeSearchBlurTimerRef.current);
      recipeSearchBlurTimerRef.current = null;
    }
    setRecipeSearchFocused(true);
  }, []);

  const onRecipeSearchBlur = useCallback(() => {
    recipeSearchBlurTimerRef.current = setTimeout(() => {
      setRecipeSearchFocused(false);
      recipeSearchBlurTimerRef.current = null;
    }, 180);
  }, []);

  const selectRecipeFromLibrary = useCallback((recipe: Recipe) => {
    Keyboard.dismiss();
    if (recipeSearchBlurTimerRef.current) {
      clearTimeout(recipeSearchBlurTimerRef.current);
      recipeSearchBlurTimerRef.current = null;
    }
    userSelectedRecipeThisSessionRef.current = true;
    setSelectedRecipeId(recipe.id);
    setSelectedRecipePreview(recipe);
    setName(recipe.name);
    lastHydratedRecipeIngredientsRef.current = null;
    setRecipeSearchFocused(false);
    setRecipeSearchQuery('');
    void queryClient.prefetchQuery({
      queryKey: queryKeys.recipeDetail(recipe.id),
      queryFn: () => fetchRecipeDetailBundle(recipe.id),
      staleTime: RECIPE_DETAIL_STALE_MS,
    });
  }, [queryClient]);

  const onPickNoRecipe = useCallback(() => {
    Keyboard.dismiss();
    if (recipeSearchBlurTimerRef.current) {
      clearTimeout(recipeSearchBlurTimerRef.current);
      recipeSearchBlurTimerRef.current = null;
    }
    clearRecipeSelection();
  }, [clearRecipeSelection]);

  const applyMealTypeChip = useCallback((chip: MealSlotChip) => {
    if (chip.slot === 'custom' && chip.customPreset) {
      setMealSlot('custom');
      setCustomSlotName(chip.customPreset);
    } else {
      setMealSlot(chip.slot);
      setCustomSlotName('');
    }
  }, []);

  const handleSave = async () => {
    Keyboard.dismiss();

    const uid = typeof userId === 'string' ? userId : null;
    if (!uid) {
      setErrorDialog({ title: 'Error', message: 'You must be signed in to save a meal.' });
      return;
    }

    if (mealSlot === 'custom' && !customSlotName.trim()) {
      setErrorDialog({
        title: 'Meal type',
        message: 'Please choose a meal type chip (Snack uses a built-in label).',
      });
      return;
    }

    const trimmedDate = mealDate.trim();
    if (!trimmedDate || !/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
      setErrorDialog({ title: 'Invalid date', message: 'Please select a valid date.' });
      return;
    }

    setSaving(true);
    try {
      const ings = ingredients
        .filter((i) => i.name.trim())
        .map((i) => {
          const qtyStr = i.quantity_value.trim();
          let quantity_value: number | null = null;
          if (qtyStr) {
            const parsed = parseFloat(qtyStr);
            quantity_value = Number.isNaN(parsed) ? null : parsed;
          }
          return {
            name: titleCaseWords(i.name.trim()),
            normalized_name: normalize(titleCaseWords(i.name.trim())),
            quantity_value,
            quantity_unit: i.quantity_unit.trim() || null,
            notes: i.notes.trim() || null,
            brand_preference: i.brand_preference.trim() || null,
          };
        });

      const mealTitle = name.trim() ? titleCaseWords(name.trim()) : 'Untitled meal';
      const customName =
        mealSlot === 'custom' && customSlotName.trim()
          ? titleCaseWords(customSlotName.trim())
          : null;

      if (isNew) {
        let dates = expandMealRepeatDates(repeatMode, trimmedDate);
        if (dates.length === 0) dates = [trimmedDate];

        const existingMeals = isPremium ? [] : await getMeals(uid);
        const allowed = await ensureFreeTierCapacity('meal', existingMeals.length, dates.length, isPremium, isPremiumLoading);
        if (!allowed) {
          setSaving(false);
          return;
        }

        const mealPayload = {
          name: mealTitle,
          meal_slot: mealSlot,
          custom_slot_name: mealSlot === 'custom' ? customName : null,
          recipe_id: selectedRecipeId,
          recipe_url: null,
          notes: notes.trim() || null,
        };
        let firstMealId: string | null = null;
        for (const d of dates) {
          const meal = await createMeal(uid, { ...mealPayload, meal_date: d });
          await setMealIngredients(meal.id, ings);
          if (!firstMealId) firstMealId = meal.id;
        }
        await invalidateMealsRange(queryClient, uid);
        notifyMealSavedForMilestones();
        void notifyFreeTierNearLimitIfNeeded('meal', existingMeals.length + dates.length);
        navigation.replace('MealDetails', { mealId: firstMealId! });
      } else {
        await updateMeal(mealId!, {
          name: mealTitle,
          meal_date: trimmedDate,
          meal_slot: mealSlot,
          custom_slot_name: mealSlot === 'custom' ? customName : null,
          recipe_id: selectedRecipeId,
          recipe_url: null,
          notes: notes.trim() || null,
        });
        await setMealIngredients(mealId!, ings);
        await invalidateMealsRange(queryClient, uid);
        void queryClient.invalidateQueries({ queryKey: queryKeys.mealDetail(uid, mealId!) });
        navigation.goBack();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setErrorDialog({ title: 'Could not save', message });
    } finally {
      setSaving(false);
    }
  };

  const addPill = (
    <TouchableOpacity
      onPress={handleSave}
      disabled={saving}
      style={[
        styles.savePill,
        {
          backgroundColor: theme.accent,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.accent,
          opacity: saving ? 0.85 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={isNew ? 'Add meal' : 'Save meal'}
      accessibilityState={{ disabled: saving }}
    >
      {saving ? (
        <ActivityIndicator color={theme.onAccent} size="small" />
      ) : (
        <Text style={[theme.typography.subhead, { color: theme.onAccent, fontWeight: '600' }]}>
          {isNew ? 'Add' : 'Save'}
        </Text>
      )}
    </TouchableOpacity>
  );

  if (!isNew) {
    if (userId === undefined) {
      return (
        <Screen padded safeTop={false} safeBottom={false}>
          <PushedScreenHeader title={headerTitle} onBack={() => navigation.goBack()} />
          <View style={styles.centeredLoader}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        </Screen>
      );
    }
    if (userId === null) {
      return (
        <Screen padded safeTop={false} safeBottom={false}>
          <PushedScreenHeader title={headerTitle} onBack={() => navigation.goBack()} />
          <View style={styles.centeredLoader}>
            <Text style={[theme.typography.body, { color: theme.textSecondary }]}>
              Sign in to edit this meal.
            </Text>
          </View>
        </Screen>
      );
    }
    if (userReady && detailQuery.isPending && !detailQuery.data) {
      return (
        <Screen padded safeTop={false} safeBottom={false}>
          <PushedScreenHeader title={headerTitle} onBack={() => navigation.goBack()} />
          <View style={styles.centeredLoader}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        </Screen>
      );
    }
  }

  const selectedRowMeta =
    displayRecipeForRow != null ? formatRecipeMetaLine(displayRecipeForRow) : '';

  return (
    <Screen padded safeTop={false} safeBottom={false}>
      <PushedScreenHeader title={headerTitle} onBack={() => navigation.goBack()} rightAccessory={addPill} />
      <KeyboardSafeForm style={styles.keyboard}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: scrollBottomPad }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <ListSection title="Recipe" {...recipeListSectionProps}>
            {displayRecipeForRow ? (
              <View
                style={[
                  styles.selectedRecipeRow,
                  {
                    backgroundColor: theme.accent + '22',
                    borderColor: theme.accent,
                  },
                ]}
              >
                <View style={[styles.recipeIconTile, { backgroundColor: theme.accent }]}>
                  <Ionicons name="restaurant" size={20} color={theme.onAccent} />
                </View>
                <View style={styles.selectedRecipeText}>
                  <Text
                    style={[theme.typography.body, { color: theme.textPrimary, fontWeight: '700' }]}
                    numberOfLines={2}
                  >
                    {displayRecipeForRow.name}
                  </Text>
                  {selectedRowMeta ? (
                    <Text
                      style={[theme.typography.footnote, { color: theme.textSecondary, marginTop: 2 }]}
                      numberOfLines={2}
                    >
                      {selectedRowMeta}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={beginRecipeSearch}
                  style={[
                    styles.changePill,
                    {
                      borderColor: theme.accent,
                      backgroundColor: theme.surface,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Change recipe"
                >
                  <Text style={[theme.typography.caption1, { color: theme.accent, fontWeight: '600' }]}>
                    Change
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <RecipeSearchBar
                  inputRef={recipeSearchInputRef}
                  value={recipeSearchQuery}
                  onChangeText={setRecipeSearchQuery}
                  onFocus={onRecipeSearchFocus}
                  onBlur={onRecipeSearchBlur}
                  placeholder="Search recipes…"
                />
                {recipeSearchFocused ? (
                  <View
                    style={[
                      styles.inlineResults,
                      {
                        borderColor: theme.divider,
                        backgroundColor: theme.surface,
                      },
                    ]}
                  >
                    {recipesPickerQuery.isPending ? (
                      <View style={styles.inlineResultsLoading}>
                        <ActivityIndicator color={theme.accent} />
                      </View>
                    ) : recipesPickerQuery.isError ? (
                      <Text
                        style={[
                          theme.typography.footnote,
                          { color: theme.textSecondary, padding: spacing.md },
                        ]}
                      >
                        Could not load recipes.
                      </Text>
                    ) : (
                      <ScrollView
                        nestedScrollEnabled
                        keyboardShouldPersistTaps="handled"
                        style={styles.inlineResultsScroll}
                        showsVerticalScrollIndicator
                      >
                        <TouchableOpacity
                          style={[styles.recipeResultRow, { borderBottomColor: theme.divider }]}
                          onPress={onPickNoRecipe}
                          accessibilityRole="button"
                          accessibilityLabel="No recipe"
                        >
                          <Text style={[theme.typography.body, { color: theme.textSecondary }]}>
                            No recipe
                          </Text>
                        </TouchableOpacity>
                        {filteredPickerRecipes.map((item) => (
                          <TouchableOpacity
                            key={item.id}
                            style={[styles.recipeResultRow, { borderBottomColor: theme.divider }]}
                            onPress={() => selectRecipeFromLibrary(item)}
                            accessibilityRole="button"
                            accessibilityLabel={item.name}
                          >
                            <Text
                              style={[theme.typography.body, { color: theme.textPrimary, fontWeight: '600' }]}
                            >
                              {item.name}
                            </Text>
                            <Text
                              style={[
                                theme.typography.caption1,
                                { color: theme.textSecondary, marginTop: 2 },
                              ]}
                            >
                              {formatRecipeMetaLine(item)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                        {filteredPickerRecipes.length === 0 &&
                        debouncedRecipeSearch.trim() !== '' &&
                        (recipesPickerQuery.data?.recipes?.length ?? 0) > 0 ? (
                          <Text
                            style={[
                              theme.typography.footnote,
                              { color: theme.textSecondary, padding: spacing.md },
                            ]}
                          >
                            No recipes match that search.
                          </Text>
                        ) : null}
                        {filteredPickerRecipes.length === 0 &&
                        (recipesPickerQuery.data?.recipes?.length ?? 0) === 0 ? (
                          <Text
                            style={[
                              theme.typography.footnote,
                              { color: theme.textSecondary, padding: spacing.md },
                            ]}
                          >
                            No saved recipes yet. Add some in the Recipes tab.
                          </Text>
                        ) : null}
                      </ScrollView>
                    )}
                  </View>
                ) : null}
              </>
            )}
          </ListSection>

          <ListSection title="Schedule" {...recipeListSectionProps}>
            <View
              style={[
                styles.group,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.divider,
                },
              ]}
            >
              <View style={styles.groupRow}>
                <Text style={[theme.typography.footnote, styles.rowLabel, { color: theme.textSecondary }]}>
                  Date
                </Text>
                <AppDateField
                  value={mealDate}
                  onChange={setMealDate}
                  embedded
                  containerStyle={fieldFlush}
                  accessibilityLabel="Meal date"
                />
              </View>
              {isNew ? (
                <>
                  <View style={[styles.groupDivider, { backgroundColor: theme.divider }]} />
                  <View style={styles.groupRow}>
                    <Text style={[theme.typography.footnote, styles.rowLabel, { color: theme.textSecondary }]}>
                      Repeat
                    </Text>
                    <AppSelectField
                      value={MEAL_REPEAT_LABELS[repeatMode]}
                      onPress={() => setRepeatSheetVisible(true)}
                      placeholder="Never"
                      embedded
                      containerStyle={fieldFlush}
                      accessibilityLabel="Repeat schedule"
                    />
                  </View>
                </>
              ) : null}
            </View>

            <Text
              style={[
                theme.typography.caption1,
                {
                  color: theme.textSecondary,
                  textTransform: 'uppercase',
                  marginTop: theme.spacing.md,
                  marginBottom: theme.spacing.sm,
                },
              ]}
            >
              Meal type
            </Text>
            <ScrollView
              ref={chipScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
              keyboardShouldPersistTaps="handled"
            >
              {MEAL_SLOT_CHIPS.map((chip) => {
                const selected = chipSelected(chip, mealSlot, customSlotName);
                return (
                  <TouchableOpacity
                    key={chip.key}
                    onPress={() => applyMealTypeChip(chip)}
                    style={[
                      styles.mealChip,
                      {
                        backgroundColor: selected ? theme.accent : theme.surface,
                        borderColor: selected ? theme.accent : theme.divider,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${chip.label} meal type`}
                    accessibilityState={{ selected }}
                  >
                    <Text
                      style={[
                        theme.typography.subhead,
                        {
                          color: selected ? theme.onAccent : theme.textPrimary,
                          fontWeight: '600',
                        },
                      ]}
                    >
                      {chip.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </ListSection>

          <ListSection
            title="Ingredients"
            {...recipeListSectionProps}
            headerRight={
              <TouchableOpacity
                onPress={addIngredient}
                style={styles.sectionHeaderBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Add ingredient"
              >
                <Text style={[theme.typography.subhead, { color: theme.accent, fontWeight: '600' }]}>+ Add</Text>
              </TouchableOpacity>
            }
          >
            {ingredients.map((ing, idx) => (
              <View
                key={idx}
                style={[
                  styles.ingredientRow,
                  idx < ingredients.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: theme.divider,
                    paddingBottom: theme.spacing.sm,
                    marginBottom: theme.spacing.sm,
                  },
                ]}
              >
                <TextField
                  value={ing.name}
                  onChangeText={(v) => updateIngredient(idx, 'name', v)}
                  placeholder="Name"
                  containerStyle={styles.ingName}
                  style={styles.compactLineInput}
                  formatOnBlur="titleWords"
                />
                <TextField
                  value={ing.quantity_value}
                  onChangeText={(v) => updateIngredient(idx, 'quantity_value', v)}
                  placeholder="Qty"
                  textAlign="center"
                  containerStyle={styles.ingQty}
                  style={[styles.compactLineInput, styles.ingQtyInput]}
                />
                <View style={styles.ingUnitWrap}>
                  <TouchableOpacity
                    onPress={() => { Keyboard.dismiss(); setUnitPickerIdx(idx); }}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Change unit for ingredient ${idx + 1}`}
                    accessibilityHint="Opens unit options"
                    style={[styles.ingUnit, styles.unitTrigger, { backgroundColor: theme.background, borderColor: theme.divider }]}
                  >
                    <Text style={[theme.typography.body, { color: theme.textPrimary }]}>
                      {normalizeUnitValue(ing.quantity_unit)}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  onPress={() => removeIngredient(idx)}
                  style={[styles.removeBtn, { backgroundColor: theme.surface }]}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ingredient ${idx + 1}`}
                >
                  <Ionicons name="close-outline" size={24} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            ))}
          </ListSection>

          <ListSection title="Notes" {...recipeListSectionProps}>
            <TextField
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional notes"
              multiline
              multilineVerticalAlign="center"
              containerStyle={{ marginBottom: 0 }}
            />
          </ListSection>
        </ScrollView>
      </KeyboardSafeForm>

      <UnitPickerSheet
        visible={unitPickerIdx !== null}
        onClose={() => setUnitPickerIdx(null)}
        value={unitPickerIdx !== null ? (ingredients[unitPickerIdx]?.quantity_unit ?? 'ea') : 'ea'}
        onSelect={(u) => {
          if (unitPickerIdx !== null) updateIngredient(unitPickerIdx, 'quantity_unit', u);
          setUnitPickerIdx(null);
        }}
      />

      <MealRepeatSheet
        visible={repeatSheetVisible}
        onClose={() => setRepeatSheetVisible(false)}
        value={repeatMode}
        onSelect={setRepeatMode}
      />

      <AppConfirmationDialog
        visible={!!errorDialog}
        onClose={() => setErrorDialog(null)}
        title={errorDialog?.title ?? ''}
        message={errorDialog?.message}
        buttons={[{ label: 'OK', onPress: () => setErrorDialog(null) }]}
        allowBackdropDismiss
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centeredLoader: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 200 },
  keyboard: { flex: 1 },
  scroll: { flex: 1 },
  content: { flexGrow: 1 },
  savePill: {
    minWidth: 56,
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlineResults: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    maxHeight: 280,
  },
  inlineResultsScroll: {
    maxHeight: 280,
  },
  inlineResultsLoading: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  recipeResultRow: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  selectedRecipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
  },
  recipeIconTile: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedRecipeText: { flex: 1, minWidth: 0 },
  changePill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  group: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    minHeight: 52,
  },
  rowLabel: {
    width: ROW_LABEL_W,
    marginRight: spacing.sm,
  },
  groupDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: spacing.md,
    alignSelf: 'stretch',
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  mealChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionHeaderBtn: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  /** Same rhythm as recipe edit and default unit dropdown trigger. */
  compactLineInput: {
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: spacing.sm,
  },
  ingQtyInput: { paddingHorizontal: spacing.xs },
  ingName: { flex: 1, minWidth: 0, marginBottom: 0 },
  ingQty: { width: spacing.md * 5, minWidth: spacing.md * 5, marginBottom: 0, flexShrink: 0 },
  ingUnitWrap: { maxWidth: 96, flexBasis: 96, marginBottom: 0, flexShrink: 1 },
  ingUnit: { marginBottom: 0 },
  unitTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.input,
    borderWidth: 1,
  },
  removeBtn: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: MIN_TOUCH_TARGET / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
