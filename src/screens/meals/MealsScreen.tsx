import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Platform, ActivityIndicator } from 'react-native';
import { useFocusEffect, useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { openPlanScreen } from '../../navigation/openPlanScreen';
import { useQuery, useQueryClient, useIsRestoring, keepPreviousData } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MealsStackParamList } from '../../navigation/types';
import { useTheme } from '../../design/ThemeContext';
import { tabRootScrollPaddingBottom, tabRootScrollPaddingTop, useTabRootBarHeight } from '../../design/layout';
import { useTabRootScrollOnScroll } from '../../navigation/NavigationChromeScrollContext';
import { Screen } from '../../components/ui/Screen';
import { QueryLoadErrorPanel } from '../../components/ui/QueryLoadErrorPanel';
import {
  getScheduleDates,
  toDateString,
  formatDayLabel,
  formatScheduleLabel,
  shiftScheduleWindow,
  shiftScheduleStartToIncludeDate,
} from '../../utils/dateUtils';
import { DaySection } from '../../components/meals/DaySection';
import { MealsScreenHeader } from '../../components/meals/MealsScreenHeader';
import { WeekStrip } from '../../components/meals/WeekStrip';
import { ScheduleConfigSheet } from '../../components/meals/ScheduleConfigSheet';
import { useMealScheduleConfig, type MealScheduleConfig } from '../../hooks/useMealScheduleConfig';
import type { Meal } from '../../types/models';
import { useAuth } from '../../context/AuthContext';
import { useLazyMount } from '../../hooks/useLazyMount';
import { fetchUserPreferences, patchUserPreferencesIfSync } from '../../services/userPreferencesService';
import { useDebounce } from '../../hooks/useDebounce';
import { showError } from '../../utils/appToast';
import { isNotSignedInError } from '../../utils/mapDbError';
import { queryKeys } from '../../query/keys';
import { fetchMealsRangeBundle, MEALS_RANGE_STALE_MS } from '../../query/mealsRangeBundle';
import { fetchMealDetailBundle, MEAL_DETAIL_STALE_MS } from '../../query/mealDetailBundle';
import { deleteMeal } from '../../services/mealService';
import { FreeTierUsageBanner } from '../../components/subscription/FreeTierUsageBanner';
import { invalidateMealsRange } from '../../query/invalidate';
import { RECIPE_CARD_GAP } from '../../design/recipeLayout';

function getSlotKey(meal: Meal): string {
  if (meal.meal_slot === 'custom' && meal.custom_slot_name) {
    return `custom:${meal.custom_slot_name}`;
  }
  return meal.meal_slot;
}

/** Stable empty map so `DaySection`'s memo holds on days without meals. */
const EMPTY_MEALS_BY_SLOT: Map<string, Meal> = new Map();

export function MealsScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabRootBarHeight();
  /** Tight under header: schedule row sits close to week strip (no extra chrome gap). */
  const scrollContentPaddingTop = tabRootScrollPaddingTop(insets.top, theme.spacing);
  const onScrollChrome = useTabRootScrollOnScroll('MealsStack');
  const navigation = useNavigation<NativeStackNavigationProp<MealsStackParamList>>();
  const { config, setConfig } = useMealScheduleConfig();
  const { userId, isAuthReady } = useAuth();
  const tabNavigation = useNavigation<NavigationProp<ParamListBase>>();
  const handleOpenPlan = useCallback(() => {
    openPlanScreen(tabNavigation);
  }, [tabNavigation]);
  const [screenFocused, setScreenFocused] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [scheduleSheetVisible, setScheduleSheetVisible] = useState(false);
  const scheduleSheetMounted = useLazyMount(scheduleSheetVisible);
  const [selectedDateString, setSelectedDateString] = useState(() =>
    toDateString(new Date())
  );

  const mealsPrefsReady = useRef(false);
  const mealsPrefsHydrated = useRef(false);
  const scheduleConfigRef = useRef(config);
  scheduleConfigRef.current = config;

  const userReady = typeof userId === 'string' && userId.length > 0;

  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      const today = toDateString(new Date());
      const { startDate, length } = scheduleConfigRef.current;
      const nextStart = shiftScheduleStartToIncludeDate(startDate, length, today);
      if (nextStart !== startDate) {
        setConfig({ startDate: nextStart, length });
      }
      setSelectedDateString(today);
      return () => setScreenFocused(false);
    }, [setConfig])
  );

  const isRestoringCache = useIsRestoring();

  const visibleDates = useMemo(
    () => getScheduleDates(config.startDate, config.length),
    [config.startDate, config.length]
  );
  const rangeLabel =
    visibleDates.length > 0
      ? formatScheduleLabel(
          visibleDates[0],
          visibleDates[visibleDates.length - 1],
          config.length
        )
      : '';

  useEffect(() => {
    if (mealsPrefsHydrated.current) return;
    let cancelled = false;
    (async () => {
      await fetchUserPreferences();
      if (cancelled) return;
      mealsPrefsReady.current = true;
      mealsPrefsHydrated.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const debouncedPersistMealsDate = useDebounce(() => {
    if (!mealsPrefsReady.current) return;
    patchUserPreferencesIfSync({ mealsUi: { lastSelectedDate: selectedDateString } });
  }, 500);

  useEffect(() => {
    debouncedPersistMealsDate();
  }, [selectedDateString, debouncedPersistMealsDate]);

  const goToPrevWindow = useCallback(() => {
    const newStart = shiftScheduleWindow(config.startDate, -config.length);
    setConfig({ startDate: newStart, length: config.length });
    setSelectedDateString(newStart);
  }, [config, setConfig]);

  const goToNextWindow = useCallback(() => {
    const newStart = shiftScheduleWindow(config.startDate, config.length);
    setConfig({ startDate: newStart, length: config.length });
    setSelectedDateString(newStart);
  }, [config, setConfig]);

  const rangeStart = visibleDates[0] ? toDateString(visibleDates[0]) : '';
  const rangeEnd = visibleDates.length > 0 ? toDateString(visibleDates[visibleDates.length - 1]) : '';

  const rangeReady = Boolean(rangeStart && rangeEnd);

  const mealsQuery = useQuery({
    queryKey: queryKeys.mealsRange(userId ?? '', rangeStart, rangeEnd),
    queryFn: () => fetchMealsRangeBundle(userId!, rangeStart, rangeEnd),
    enabled: isAuthReady && screenFocused && userReady && rangeReady,
    staleTime: MEALS_RANGE_STALE_MS,
    placeholderData: keepPreviousData,
  });

  const bundle = mealsQuery.data;
  const meals = React.useMemo(() => bundle?.meals ?? [], [bundle?.meals]);
  const ingredientCounts = bundle?.ingredientCounts ?? {};
  const recipeMetaByRecipeId = bundle?.recipeMetaByRecipeId ?? {};

  const listInitialLoad =
    isAuthReady &&
    userReady &&
    screenFocused &&
    rangeReady &&
    mealsQuery.data === undefined &&
    (mealsQuery.isPending || isRestoringCache);

  const showAuthBlockingSpinner =
    !isAuthReady || userId === undefined || isNotSignedInError(mealsQuery.error);

  useEffect(() => {
    if (!mealsQuery.isError || isNotSignedInError(mealsQuery.error)) return;
    showError('Could not load meals.');
  }, [mealsQuery.isError, mealsQuery.error]);

  useEffect(() => {
    if (!isAuthReady || !userReady || !isNotSignedInError(mealsQuery.error)) return;
    void mealsQuery.refetch();
  }, [isAuthReady, userReady, mealsQuery]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void mealsQuery.refetch().finally(() => setRefreshing(false));
  }, [mealsQuery]);

  const mealsByDate = React.useMemo(() => {
    const map = new Map<string, Map<string, Meal>>();
    for (const meal of meals) {
      const dateKey = meal.meal_date;
      if (!map.has(dateKey)) map.set(dateKey, new Map());
      const slotKey = getSlotKey(meal);
      map.get(dateKey)!.set(slotKey, meal);
    }
    return map;
  }, [meals]);

  const handlePressMeal = useCallback(
    (meal: Meal) => {
      if (userId) {
        void queryClient.prefetchQuery({
          queryKey: queryKeys.mealDetail(userId, meal.id),
          queryFn: () => fetchMealDetailBundle(userId, meal.id),
          staleTime: MEAL_DETAIL_STALE_MS,
        });
      }
      navigation.navigate('MealDetails', { mealId: meal.id });
    },
    [navigation, queryClient, userId]
  );

  const handlePressAdd = useCallback(
    (dateString: string, slotKey: string, slotLabel: string) => {
      const preFillDate = dateString || selectedDateString;
      const preFillSlot = slotKey && !slotKey.startsWith('custom:') ? slotKey : undefined;
      const preFillCustomSlotName =
        slotKey?.startsWith('custom:') ? slotLabel : undefined;

      navigation.navigate('MealEdit', {
        preFillDate,
        preFillSlot,
        preFillCustomSlotName,
      });
    },
    [navigation, selectedDateString]
  );

  const handleDeleteMeal = useCallback(
    async (meal: Meal) => {
      try {
        await deleteMeal(meal.id);
        if (userId) {
          queryClient.removeQueries({ queryKey: queryKeys.mealDetail(userId, meal.id) });
          await invalidateMealsRange(queryClient, userId);
        }
      } catch {
        showError('Could not delete meal.');
      }
    },
    [queryClient, userId]
  );

  const selectedDate =
    visibleDates.find((d) => toDateString(d) === selectedDateString) ?? visibleDates[0];
  const dateLabel = selectedDate ? formatDayLabel(selectedDate) : '';
  const mealsBySlot = useMemo(
    () => mealsByDate.get(selectedDateString) ?? EMPTY_MEALS_BY_SLOT,
    [mealsByDate, selectedDateString]
  );

  const showWeekStrip = visibleDates.length > 0;

  const handleScheduleSave = useCallback(
    (next: MealScheduleConfig) => {
      setConfig(next);
      setSelectedDateString(next.startDate);
    },
    [setConfig]
  );

  const headerChrome = (
    <MealsScreenHeader
      scheduleLabel={rangeLabel}
      onSchedulePress={() => setScheduleSheetVisible(true)}
      onPrev={goToPrevWindow}
      onNext={goToNextWindow}
    />
  );

  const scrollBottomPad = tabRootScrollPaddingBottom(tabBarHeight, theme.spacing);

  const mealsLoadFailed =
    userReady &&
    mealsQuery.isError &&
    mealsQuery.data === undefined &&
    !isNotSignedInError(mealsQuery.error);

  if (mealsLoadFailed) {
    const errMsg =
      mealsQuery.error instanceof Error
        ? mealsQuery.error.message
        : 'Could not load meals.';
    return (
      <Screen padded={false} safeTop={false} safeBottom={false}>
        <View style={styles.headerOverlay} pointerEvents="box-none">
          {headerChrome}
        </View>
        <QueryLoadErrorPanel
          message={errMsg}
          onRetry={() => void mealsQuery.refetch()}
        />
      </Screen>
    );
  }

  if (showAuthBlockingSpinner) {
    return (
      <Screen padded={false} safeTop={false} safeBottom={false}>
        <View style={styles.headerOverlay} pointerEvents="box-none">
          {headerChrome}
        </View>
        <View style={styles.inlineSpinner}>
          <ActivityIndicator color={theme.accent} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} safeTop={false} safeBottom={false}>
      <View style={styles.headerOverlay} pointerEvents="box-none">
        {headerChrome}
      </View>
      <View style={styles.container}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: scrollContentPaddingTop,
              paddingHorizontal: theme.spacing.md,
              paddingBottom: scrollBottomPad,
            },
          ]}
          contentInsetAdjustmentBehavior={Platform.OS === 'ios' ? 'never' : undefined}
          nestedScrollEnabled
          onScroll={onScrollChrome}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.accent}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <FreeTierUsageBanner
            kind="meal"
            currentCount={meals.length}
            onPressUpgrade={handleOpenPlan}
          />
          {showWeekStrip ? (
            <WeekStrip
              dates={visibleDates}
              selectedDateString={selectedDateString}
              onSelectDate={setSelectedDateString}
            />
          ) : null}
          <View
            style={[
              styles.planner,
              showWeekStrip && { paddingTop: RECIPE_CARD_GAP },
            ]}
          >
            {listInitialLoad ? (
              <View style={styles.plannerLoading}>
                <ActivityIndicator color={theme.accent} />
              </View>
            ) : (
              <DaySection
                dateLabel={dateLabel}
                dateString={selectedDateString}
                mealsBySlot={mealsBySlot}
                ingredientCountByMealId={ingredientCounts}
                recipeMetaByRecipeId={recipeMetaByRecipeId}
                onPressMeal={handlePressMeal}
                onPressAdd={handlePressAdd}
                onDeleteMeal={handleDeleteMeal}
              />
            )}
          </View>
        </ScrollView>

        {scheduleSheetMounted ? (
          <ScheduleConfigSheet
            visible={scheduleSheetVisible}
            onClose={() => setScheduleSheetVisible(false)}
            config={config}
            onSave={handleScheduleSave}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  inlineSpinner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** overflow: visible so WeekStrip horizontal pill bleed can extend to screen edges. */
  scroll: { flex: 1, overflow: 'visible' },
  scrollContent: {},
  planner: {},
  plannerLoading: {
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
