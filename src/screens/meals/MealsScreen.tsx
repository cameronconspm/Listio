import React, { useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Platform, ActivityIndicator } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useQuery, useQueryClient, useIsRestoring, keepPreviousData } from '@tanstack/react-query';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MealsStackParamList } from '../../navigation/types';
import { useTheme } from '../../design/ThemeContext';
import { useTabRootScrollOnScroll } from '../../navigation/NavigationChromeScrollContext';
import { Screen } from '../../components/ui/Screen';
import {
  getScheduleDates,
  toDateString,
  formatDayLabel,
  formatScheduleLabel,
  shiftScheduleWindow,
  clampSelectedDateToWindow,
} from '../../utils/dateUtils';
import { DaySection } from '../../components/meals/DaySection';
import { MealsScreenHeader } from '../../components/meals/MealsScreenHeader';
import { WeekStrip } from '../../components/meals/WeekStrip';
import { ScheduleConfigSheet } from '../../components/meals/ScheduleConfigSheet';
import { useMealScheduleConfig, type MealScheduleConfig } from '../../hooks/useMealScheduleConfig';
import type { Meal } from '../../types/models';
import { useAuthUserId } from '../../context/AuthUserIdContext';
import { useLazyMount } from '../../hooks/useLazyMount';
import { fetchUserPreferences, patchUserPreferencesIfSync } from '../../services/userPreferencesService';
import { useDebounce } from '../../hooks/useDebounce';
import { showError } from '../../utils/appToast';
import { queryKeys } from '../../query/keys';
import { fetchMealsRangeBundle, MEALS_RANGE_STALE_MS } from '../../query/mealsRangeBundle';
import { fetchMealDetailBundle, MEAL_DETAIL_STALE_MS } from '../../query/mealDetailBundle';

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
  const tabBarHeight = useBottomTabBarHeight();
  const headerHeight = useHeaderHeight();
  /** Tight under header: schedule row sits close to week strip (no extra chrome gap). */
  const scrollContentPaddingTop = headerHeight + theme.spacing.xxs;
  const onScrollChrome = useTabRootScrollOnScroll('MealsStack');
  const navigation = useNavigation<NativeStackNavigationProp<MealsStackParamList>>();
  const { config, setConfig } = useMealScheduleConfig();
  const userId = useAuthUserId();
  const [screenFocused, setScreenFocused] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [scheduleSheetVisible, setScheduleSheetVisible] = useState(false);
  const scheduleSheetMounted = useLazyMount(scheduleSheetVisible);
  const [selectedDateString, setSelectedDateString] = useState(() =>
    toDateString(new Date())
  );

  const mealsPrefsReady = useRef(false);
  const mealsPrefsHydrated = useRef(false);

  const userReady = typeof userId === 'string' && userId.length > 0;

  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      return () => setScreenFocused(false);
    }, [])
  );

  const isRestoringCache = useIsRestoring();

  const visibleDates = getScheduleDates(config.startDate, config.length);
  const rangeLabel =
    visibleDates.length > 0
      ? formatScheduleLabel(
          visibleDates[0],
          visibleDates[visibleDates.length - 1],
          config.length
        )
      : '';

  useEffect(() => {
    const clamped = clampSelectedDateToWindow(selectedDateString, visibleDates);
    if (clamped !== selectedDateString) {
      setSelectedDateString(clamped);
    }
  }, [config.startDate, config.length, visibleDates, selectedDateString]);

  useEffect(() => {
    if (visibleDates.length === 0 || mealsPrefsHydrated.current) return;
    let cancelled = false;
    (async () => {
      const p = await fetchUserPreferences();
      if (cancelled) return;
      const d = p.mealsUi?.lastSelectedDate;
      if (d && visibleDates.some((v) => toDateString(v) === d)) {
        setSelectedDateString(d);
      }
      mealsPrefsReady.current = true;
      mealsPrefsHydrated.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [visibleDates]);

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
    enabled: screenFocused && userReady && rangeReady,
    staleTime: MEALS_RANGE_STALE_MS,
    placeholderData: keepPreviousData,
  });

  const bundle = mealsQuery.data;
  const meals = React.useMemo(() => bundle?.meals ?? [], [bundle?.meals]);
  const ingredientCounts = bundle?.ingredientCounts ?? {};

  const listInitialLoad =
    userReady &&
    screenFocused &&
    rangeReady &&
    mealsQuery.data === undefined &&
    (mealsQuery.isPending || isRestoringCache);

  useEffect(() => {
    if (mealsQuery.isError) {
      showError('Could not load meals.');
    }
  }, [mealsQuery.isError]);

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

  const selectedDate =
    visibleDates.find((d) => toDateString(d) === selectedDateString) ?? visibleDates[0];
  const dateLabel = selectedDate ? formatDayLabel(selectedDate) : '';
  const mealsBySlot = useMemo(
    () => mealsByDate.get(selectedDateString) ?? EMPTY_MEALS_BY_SLOT,
    [mealsByDate, selectedDateString]
  );

  const handleScheduleSave = useCallback(
    (next: MealScheduleConfig) => {
      setConfig(next);
      setSelectedDateString(next.startDate);
    },
    [setConfig]
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      header: () => (
        <MealsScreenHeader
          scheduleLabel={rangeLabel}
          onSchedulePress={() => setScheduleSheetVisible(true)}
          onPrev={goToPrevWindow}
          onNext={goToNextWindow}
        />
      ),
    });
  }, [navigation, rangeLabel, goToPrevWindow, goToNextWindow]);

  const showWeekStrip = visibleDates.length > 0;
  const scrollBottomPad = tabBarHeight + Math.max(insets.bottom, theme.spacing.md) + theme.spacing.xl;

  if (userId === undefined || listInitialLoad) {
    return (
      <Screen padded={false} safeTop={false} safeBottom={false}>
        <View style={[styles.loaderWrap, { paddingTop: scrollContentPaddingTop }]}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} safeTop={false} safeBottom={false}>
      <View style={styles.container}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: scrollContentPaddingTop,
              paddingHorizontal: theme.spacing.lg,
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
          {showWeekStrip ? (
            <WeekStrip
              dates={visibleDates}
              selectedDateString={selectedDateString}
              onSelectDate={setSelectedDateString}
            />
          ) : null}
          <View style={[styles.planner, showWeekStrip && { paddingTop: theme.spacing.xs }]}>
            <DaySection
              dateLabel={dateLabel}
              dateString={selectedDateString}
              mealsBySlot={mealsBySlot}
              ingredientCountByMealId={ingredientCounts}
              onPressMeal={handlePressMeal}
              onPressAdd={handlePressAdd}
            />
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
  /** overflow: visible so WeekStrip horizontal pill bleed can extend to screen edges. */
  scroll: { flex: 1, overflow: 'visible' },
  scrollContent: {},
  planner: {},
  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 280,
  },
});
