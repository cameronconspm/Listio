import React, { useState, useCallback, useLayoutEffect, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Linking,
  TouchableOpacity,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MealsStackParamList } from '../../navigation/types';
import { useTheme } from '../../design/ThemeContext';
import { useScrollContentInsetTop } from '../../ui/chrome/useScrollContentInsetTop';
import { Screen } from '../../components/ui/Screen';
import { HeaderIconButton } from '../../components/ui/HeaderIconButton';
import { ListSection } from '../../components/ui/ListSection';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { SecondaryButton } from '../../components/ui/SecondaryButton';
import { AppConfirmationDialog } from '../../components/ui/AppConfirmationDialog';
import { IngredientRow } from '../../components/meals/IngredientRow';
import { RecipeMetaPills } from '../../components/recipes/RecipeMetaPills';
import { addMissingIngredientsToList, deleteMeal, copyMealToDates } from '../../services/mealService';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUserId } from '../../services/supabaseClient';
import { useAuthUserId } from '../../context/AuthUserIdContext';
import { useInvalidateHomeList } from '../../hooks/useInvalidateHomeList';
import { invalidateMealsRange } from '../../query/invalidate';
import {
  formatDayLabel,
  expandMealDatesFromWeekdaySchedule,
  defaultWeekdaySelectionFromDate,
  parseYmdLocal,
} from '../../utils/dateUtils';
import { MealWeekdayScheduleSheet } from '../../components/meals/MealWeekdayScheduleSheet';
import { showError } from '../../utils/appToast';
import { queryKeys } from '../../query/keys';
import { fetchMealDetailBundle, MEAL_DETAIL_STALE_MS } from '../../query/mealDetailBundle';
import { QueryUpdatingBar } from '../../components/ui/QueryUpdatingBar';
import { spacing } from '../../design/spacing';

type Route = RouteProp<MealsStackParamList, 'MealDetails'>;

const SLOT_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  dessert: 'Dessert',
  custom: 'Custom',
};

export function MealDetailsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const queryClient = useQueryClient();
  const invalidateHomeList = useInvalidateHomeList();
  const scrollContentInsetTop = useScrollContentInsetTop();
  const scrollBottomPad = tabBarHeight + Math.max(insets.bottom, theme.spacing.md) + theme.spacing.xl;
  const navigation = useNavigation<NativeStackNavigationProp<MealsStackParamList>>();
  const route = useRoute<Route>();
  const { mealId } = route.params;
  const userId = useAuthUserId();
  const [adding, setAdding] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [copySheetVisible, setCopySheetVisible] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copyWeekdays, setCopyWeekdays] = useState<boolean[]>([
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ]);
  const [copyRecurring, setCopyRecurring] = useState(false);
  const [copyRecurringWeeks, setCopyRecurringWeeks] = useState(4);

  const userReady = typeof userId === 'string' && userId.length > 0;

  const detailQuery = useQuery({
    queryKey: queryKeys.mealDetail(userId ?? '', mealId),
    queryFn: () => fetchMealDetailBundle(userId!, mealId),
    enabled: userReady,
    staleTime: MEAL_DETAIL_STALE_MS,
  });

  const meal = detailQuery.data?.meal ?? null;
  const ingredients = detailQuery.data?.ingredients ?? [];
  const linkageById = detailQuery.data?.linkageByIngredientId ?? {};

  useEffect(() => {
    if (detailQuery.isError) {
      showError('Could not load meal.');
    }
  }, [detailQuery.isError]);

  const invalidateMealDetail = useCallback(() => {
    if (!userReady) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.mealDetail(userId, mealId) });
  }, [queryClient, userId, mealId, userReady]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderIconButton
          accessibilityLabel="Delete meal"
          onPress={() => setDeleteConfirmVisible(true)}
        >
          <Ionicons name="trash-outline" size={22} color={theme.danger} />
        </HeaderIconButton>
      ),
    });
  }, [navigation, theme.danger]);

  const handleAddMissing = async () => {
    const uid = await getUserId();
    if (!uid) return;
    setAdding(true);
    try {
      await addMissingIngredientsToList(mealId, uid);
      await invalidateHomeList();
      invalidateMealDetail();
    } catch {
      showError('Could not add ingredients to list.');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = useCallback(async () => {
    setDeleteConfirmVisible(false);
    try {
      await deleteMeal(mealId);
      const uid = await getUserId();
      if (uid) {
        queryClient.removeQueries({ queryKey: queryKeys.mealDetail(uid, mealId) });
        await invalidateMealsRange(queryClient, uid);
      }
      navigation.goBack();
    } catch {
      showError('Could not delete meal.');
    }
  }, [mealId, navigation, queryClient]);

  const handleCopyConfirm = useCallback(async () => {
    if (!meal) return;
    const userId = await getUserId();
    if (!userId) return;
    const fromToday = new Date();
    fromToday.setHours(0, 0, 0, 0);
    const targetDates = expandMealDatesFromWeekdaySchedule({
      fromDate: fromToday,
      selectedWeekdays: copyWeekdays,
      recurring: copyRecurring,
      recurringWeeks: copyRecurringWeeks,
      excludeDates: [meal.meal_date],
    });
    if (targetDates.length === 0) return;
    setCopying(true);
    try {
      await copyMealToDates(mealId, userId, targetDates);
      await invalidateMealsRange(queryClient, userId);
      setCopySheetVisible(false);
      navigation.goBack();
    } catch {
      showError('Could not copy meal.');
    } finally {
      setCopying(false);
    }
  }, [
    meal,
    mealId,
    copyWeekdays,
    copyRecurring,
    copyRecurringWeeks,
    navigation,
    queryClient,
  ]);

  const resetCopySheetFromMeal = useCallback(() => {
    if (!meal) return;
    setCopyWeekdays(defaultWeekdaySelectionFromDate(meal.meal_date));
    setCopyRecurring(false);
    setCopyRecurringWeeks(4);
  }, [meal]);

  const copySheetWasVisible = useRef(false);
  useEffect(() => {
    if (copySheetVisible && !copySheetWasVisible.current && meal) {
      resetCopySheetFromMeal();
    }
    copySheetWasVisible.current = copySheetVisible;
  }, [copySheetVisible, meal, resetCopySheetFromMeal]);

  const slotLabel = meal
    ? meal.meal_slot === 'custom' && meal.custom_slot_name
      ? meal.custom_slot_name
      : SLOT_LABELS[meal.meal_slot] ?? meal.meal_slot
    : '';
  const dateLabel = meal ? formatDayLabel(parseYmdLocal(meal.meal_date)) : '';

  const onListCount = Object.values(linkageById).filter(Boolean).length;
  const missingCount = ingredients.length - onListCount;

  const detailPills: string[] = [];
  if (dateLabel) detailPills.push(dateLabel);
  if (slotLabel) detailPills.push(slotLabel);
  if (ingredients.length === 0) {
    detailPills.push('No ingredients');
  } else {
    detailPills.push(
      `${ingredients.length} ingredient${ingredients.length !== 1 ? 's' : ''}`
    );
    if (missingCount === 0) detailPills.push('All on list');
    else detailPills.push(`${onListCount} on list`, `${missingCount} missing`);
  }

  if (userId === undefined) {
    return (
      <Screen padded safeTop={false}>
        <View style={[styles.centered, { backgroundColor: theme.background }]}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      </Screen>
    );
  }

  if (userId === null) {
    return (
      <Screen padded safeTop={false}>
        <View style={[styles.centered, { backgroundColor: theme.background }]}>
          <Text style={[theme.typography.body, { color: theme.textSecondary }]}>Sign in to view this meal.</Text>
        </View>
      </Screen>
    );
  }

  if (userReady && !detailQuery.data && detailQuery.isPending) {
    return (
      <Screen padded safeTop={false}>
        <View style={[styles.centered, { backgroundColor: theme.background }]}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      </Screen>
    );
  }

  if (!meal) {
    return (
      <Screen padded safeTop={false}>
        <View style={[styles.centered, { backgroundColor: theme.background }]}>
          <Text style={[theme.typography.body, { color: theme.textSecondary }]}>Meal not found.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded safeTop={false} safeBottom={false}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingTop: scrollContentInsetTop,
          paddingBottom: scrollBottomPad,
        }}
        showsVerticalScrollIndicator={false}
      >
        <QueryUpdatingBar visible={!!detailQuery.data && detailQuery.isFetching && !adding && !copying} />
        <Text style={[theme.typography.title2, { color: theme.textPrimary, marginBottom: theme.spacing.sm }]}>
          {meal.name}
        </Text>

        <View style={styles.pillsBlock}>
          <RecipeMetaPills labels={detailPills} />
        </View>

        {meal.recipe_url ? (
          <TouchableOpacity
            style={[styles.linkRow, { marginBottom: theme.spacing.lg }]}
            onPress={() => Linking.openURL(meal.recipe_url!)}
          >
            <Ionicons name="link" size={18} color={theme.accent} />
            <Text style={[theme.typography.body, { color: theme.accent, marginLeft: theme.spacing.sm }]}>
              Open recipe
            </Text>
          </TouchableOpacity>
        ) : null}

        <ListSection title="Ingredients" titleVariant="small" glass={false} style={styles.section}>
          {ingredients.length === 0 ? (
            <Text style={[theme.typography.body, { color: theme.textSecondary }]}>No ingredients</Text>
          ) : (
            ingredients.map((ing, idx) => (
              <IngredientRow
                key={ing.id}
                ingredient={ing}
                isOnList={linkageById[ing.id] ?? false}
                showTopDivider={idx > 0}
              />
            ))
          )}
        </ListSection>

        {meal.notes?.trim() ? (
          <ListSection title="Tips" titleVariant="small" glass={false} style={styles.section}>
            <Text style={[theme.typography.body, { color: theme.textPrimary }]}>{meal.notes.trim()}</Text>
          </ListSection>
        ) : null}

        {missingCount > 0 && (
          <PrimaryButton
            title="Add missing to list"
            onPress={handleAddMissing}
            loading={adding}
            style={styles.button}
          />
        )}
        <SecondaryButton
          title="Copy to other days"
          onPress={() => setCopySheetVisible(true)}
          loading={copying}
          style={styles.button}
        />
        <SecondaryButton
          title="Edit meal"
          onPress={() => navigation.navigate('MealEdit', { mealId })}
          style={styles.button}
        />
      </ScrollView>

      <MealWeekdayScheduleSheet
        visible={copySheetVisible}
        onClose={() => setCopySheetVisible(false)}
        title="Copy to other days"
        subtitle="Pick weekdays. Dates from today; this meal's date is skipped."
        confirmLabel="Copy"
        weekdays={copyWeekdays}
        onWeekdaysChange={setCopyWeekdays}
        recurring={copyRecurring}
        onRecurringChange={setCopyRecurring}
        recurringWeeks={copyRecurringWeeks}
        onRecurringWeeksChange={setCopyRecurringWeeks}
        onConfirm={handleCopyConfirm}
        loading={copying}
      />
      <AppConfirmationDialog
        visible={deleteConfirmVisible}
        onClose={() => setDeleteConfirmVisible(false)}
        title="Delete meal?"
        message="This cannot be undone."
        buttons={[
          { label: 'Cancel', cancel: true, onPress: () => {} },
          { label: 'Delete', destructive: true, onPress: handleDelete },
        ]}
        allowBackdropDismiss={true}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  pillsBlock: {
    marginBottom: spacing.md,
  },
  section: { marginBottom: spacing.lg },
  button: { marginBottom: spacing.sm },
});
