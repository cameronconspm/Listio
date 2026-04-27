import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Keyboard,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MealsStackParamList } from '../../navigation/types';
import { useTheme } from '../../design/ThemeContext';
import { useScrollContentInsetTop } from '../../ui/chrome/useScrollContentInsetTop';
import { Screen } from '../../components/ui/Screen';
import { KeyboardSafeForm } from '../../components/ui/KeyboardSafeForm';
import { ListSection } from '../../components/ui/ListSection';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { TextField } from '../../components/ui/TextField';
import { AppDateField } from '../../components/ui/AppDateField';
import { AppSelectField } from '../../components/ui/AppSelectField';
import { UnitDropdown } from '../../components/ui/UnitDropdown';
import { AppConfirmationDialog } from '../../components/ui/AppConfirmationDialog';
import { MealTypeOptionsSheet, formatMealSlotLabel } from '../../components/meals/MealTypeOptionsSheet';
import {
  MealWeekdayScheduleSheet,
  formatWeekdayScheduleSummary,
} from '../../components/meals/MealWeekdayScheduleSheet';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUserId } from '../../services/supabaseClient';
import { useAuthUserId } from '../../context/AuthUserIdContext';
import { invalidateMealsRange } from '../../query/invalidate';
import { queryKeys } from '../../query/keys';
import { fetchMealDetailBundle, MEAL_DETAIL_STALE_MS } from '../../query/mealDetailBundle';
import { createMeal, setMealIngredients, updateMeal } from '../../services/mealService';
import { showError, showSuccess } from '../../utils/appToast';
import { normalize } from '../../utils/normalize';
import {
  expandMealDatesFromWeekdaySchedule,
  defaultWeekdaySelectionFromDate,
  toDateString,
} from '../../utils/dateUtils';
import { titleCaseWords } from '../../utils/titleCaseWords';
import type { MealSlot } from '../../types/models';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';

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

export function MealEditScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const scrollContentInsetTop = useScrollContentInsetTop();
  const scrollBottomPad = tabBarHeight + Math.max(insets.bottom, theme.spacing.md) + theme.spacing.xxl;
  const navigation = useNavigation<NativeStackNavigationProp<MealsStackParamList>>();
  const route = useRoute<Route>();
  const { mealId, preFillDate, preFillSlot, preFillCustomSlotName } = route.params ?? {};
  const isNew = !mealId;

  const [name, setName] = useState('');
  const [mealDate, setMealDate] = useState(preFillDate ?? toDateString(new Date()));
  const [mealSlot, setMealSlot] = useState<MealSlot>(() => toMealSlot(preFillSlot));
  const [customSlotName, setCustomSlotName] = useState(preFillCustomSlotName ?? '');
  const [recipeUrl, setRecipeUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [ingredients, setIngredients] = useState<IngredientRow[]>([{ ...defaultIngredient }]);
  const [saving, setSaving] = useState(false);
  const [mealTypeSheetVisible, setMealTypeSheetVisible] = useState(false);
  const [scheduleWeekdays, setScheduleWeekdays] = useState(() =>
    defaultWeekdaySelectionFromDate(preFillDate ?? toDateString(new Date()))
  );
  const [scheduleRecurring, setScheduleRecurring] = useState(false);
  const [scheduleRecurringWeeks, setScheduleRecurringWeeks] = useState(4);
  const [scheduleSheetVisible, setScheduleSheetVisible] = useState(false);
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);

  const userId = useAuthUserId();
  const lastHydratedMealIdRef = useRef<string | null>(null);

  const userReady = typeof userId === 'string' && userId.length > 0;

  const detailQuery = useQuery({
    queryKey: queryKeys.mealDetail(userId ?? '', mealId ?? ''),
    queryFn: () => fetchMealDetailBundle(userId!, mealId!),
    enabled: Boolean(!isNew && mealId && userReady),
    staleTime: MEAL_DETAIL_STALE_MS,
  });

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
    setRecipeUrl(meal.recipe_url ?? '');
    setNotes(meal.notes ?? '');
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
    if (preFillSlot) setMealSlot(toMealSlot(preFillSlot));
    if (preFillCustomSlotName) {
      setMealSlot('custom');
      setCustomSlotName(preFillCustomSlotName);
    }
    if (preFillDate) {
      setMealDate(preFillDate);
      setScheduleWeekdays(defaultWeekdaySelectionFromDate(preFillDate));
    }
  }, [preFillDate, preFillSlot, preFillCustomSlotName]);

  useEffect(() => {
    if (!isNew) return;
    setScheduleWeekdays(defaultWeekdaySelectionFromDate(mealDate));
  }, [mealDate, isNew]);

  const addIngredient = () => {
    setIngredients((prev) => [...prev, { ...defaultIngredient }]);
  };

  const removeIngredient = (idx: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateIngredient = (idx: number, field: keyof IngredientRow, value: string) => {
    setIngredients((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const handleSave = async () => {
    Keyboard.dismiss();

    const userId = await getUserId();
    if (!userId) {
      setErrorDialog({ title: 'Error', message: 'You must be signed in to save a meal.' });
      return;
    }

    if (mealSlot === 'custom' && !customSlotName.trim()) {
      setErrorDialog({
        title: 'Custom slot required',
        message: 'Please enter a name for your custom meal slot (e.g. Snack, Brunch).',
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

      if (isNew) {
        const fromToday = new Date();
        fromToday.setHours(0, 0, 0, 0);
        let dates = expandMealDatesFromWeekdaySchedule({
          fromDate: fromToday,
          selectedWeekdays: scheduleWeekdays,
          recurring: scheduleRecurring,
          recurringWeeks: scheduleRecurringWeeks,
        });
        if (dates.length === 0) dates = [trimmedDate];
        const mealTitle = name.trim() ? titleCaseWords(name.trim()) : 'Untitled meal';
        const customName =
          mealSlot === 'custom' && customSlotName.trim()
            ? titleCaseWords(customSlotName.trim())
            : null;
        const mealPayload = {
          name: mealTitle,
          meal_slot: mealSlot,
          custom_slot_name: mealSlot === 'custom' ? customName : null,
          recipe_url: recipeUrl.trim() || null,
          notes: notes.trim() || null,
        };
        let firstMealId: string | null = null;
        for (const meal_date of dates) {
          const meal = await createMeal(userId, { ...mealPayload, meal_date });
          await setMealIngredients(meal.id, ings);
          if (!firstMealId) firstMealId = meal.id;
        }
        await invalidateMealsRange(queryClient, userId);
        showSuccess(dates.length > 1 ? `${dates.length} meals created.` : 'Meal created.');
        navigation.replace('MealDetails', { mealId: firstMealId! });
      } else {
        const mealTitle = name.trim() ? titleCaseWords(name.trim()) : 'Untitled meal';
        const customName =
          mealSlot === 'custom' && customSlotName.trim()
            ? titleCaseWords(customSlotName.trim())
            : null;
        await updateMeal(mealId!, {
          name: mealTitle,
          meal_date: trimmedDate,
          meal_slot: mealSlot,
          custom_slot_name: mealSlot === 'custom' ? customName : null,
          recipe_url: recipeUrl.trim() || null,
          notes: notes.trim() || null,
        });
        await setMealIngredients(mealId!, ings);
        await invalidateMealsRange(queryClient, userId);
        void queryClient.invalidateQueries({ queryKey: queryKeys.mealDetail(userId, mealId!) });
        showSuccess('Meal updated.');
        navigation.goBack();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setErrorDialog({ title: 'Could not save', message });
    } finally {
      setSaving(false);
    }
  };

  if (!isNew) {
    if (userId === undefined) {
      return (
        <Screen padded safeTop={false} safeBottom={false}>
          <View style={[styles.centeredLoader, { paddingTop: scrollContentInsetTop }]}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        </Screen>
      );
    }
    if (userId === null) {
      return (
        <Screen padded safeTop={false} safeBottom={false}>
          <View style={[styles.centeredLoader, { paddingTop: scrollContentInsetTop }]}>
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
          <View style={[styles.centeredLoader, { paddingTop: scrollContentInsetTop }]}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        </Screen>
      );
    }
  }

  return (
    <Screen padded safeTop={false} safeBottom={false}>
      <KeyboardSafeForm style={styles.keyboard}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: scrollContentInsetTop,
              paddingBottom: scrollBottomPad,
            },
          ]}
          contentInsetAdjustmentBehavior={Platform.OS === 'ios' ? 'never' : undefined}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <ListSection title="Basics" titleVariant="small" glass={false} style={styles.basicsSection}>
            <TextField
              label="Meal name"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Grilled chicken salad"
              containerStyle={styles.titleField}
              formatOnBlur="titleWords"
            />
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
              <View style={[styles.groupDivider, { backgroundColor: theme.divider }]} />
              <View style={styles.groupRow}>
                <Text style={[theme.typography.footnote, styles.rowLabel, { color: theme.textSecondary }]}>
                  Meal type
                </Text>
                <AppSelectField
                  value={formatMealSlotLabel(mealSlot, mealSlot === 'custom' ? customSlotName : null)}
                  onPress={() => setMealTypeSheetVisible(true)}
                  placeholder="Select"
                  embedded
                  containerStyle={fieldFlush}
                  accessibilityLabel="Meal type"
                />
              </View>
              {isNew ? (
                <>
                  <View style={[styles.groupDivider, { backgroundColor: theme.divider }]} />
                  <View style={styles.groupRow}>
                    <Text style={[theme.typography.footnote, styles.rowLabel, { color: theme.textSecondary }]}>
                      Schedule
                    </Text>
                    <AppSelectField
                      value={formatWeekdayScheduleSummary(
                        scheduleWeekdays,
                        scheduleRecurring,
                        scheduleRecurringWeeks
                      )}
                      onPress={() => setScheduleSheetVisible(true)}
                      placeholder="Select"
                      embedded
                      containerStyle={fieldFlush}
                      accessibilityLabel="Schedule"
                    />
                  </View>
                </>
              ) : null}
            </View>
            {mealSlot === 'custom' && (
              <TextField
                label="Custom slot name"
                value={customSlotName}
                onChangeText={setCustomSlotName}
                placeholder="e.g. Snack, Brunch"
                containerStyle={styles.customSlotField}
                formatOnBlur="titleWords"
              />
            )}
          </ListSection>

          <ListSection title="Ingredients" titleVariant="small" glass={false} style={styles.ingSection}>
            {ingredients.map((ing, idx) => (
              <View
                key={idx}
                style={[
                  styles.ingBlock,
                  idx < ingredients.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.divider },
                ]}
              >
                <View style={styles.ingRow1}>
                  <TextField
                    value={ing.name}
                    onChangeText={(v) => updateIngredient(idx, 'name', v)}
                    placeholder="Ingredient name"
                    containerStyle={styles.ingName}
                    formatOnBlur="titleWords"
                  />
                  <TouchableOpacity
                    onPress={() => removeIngredient(idx)}
                    style={[styles.removeBtn, { backgroundColor: theme.surface }]}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ingredient ${idx + 1}`}
                  >
                    <Ionicons
                      name="close-circle-outline"
                      size={22}
                      color={theme.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
                <View style={styles.ingRow2}>
                  <TextField
                    value={ing.quantity_value}
                    onChangeText={(v) => updateIngredient(idx, 'quantity_value', v)}
                    placeholder="Qty"
                    containerStyle={styles.ingQty}
                  />
                  <View style={styles.ingUnitWrap}>
                    <UnitDropdown
                      value={ing.quantity_unit}
                      onSelect={(u) => updateIngredient(idx, 'quantity_unit', u)}
                      containerStyle={styles.ingUnit}
                      accessibilityLabel={`Change unit for ingredient ${idx + 1}`}
                    />
                  </View>
                  <TextField
                    value={ing.notes}
                    onChangeText={(v) => updateIngredient(idx, 'notes', v)}
                    placeholder="Note (optional)"
                    containerStyle={styles.ingNote}
                  />
                </View>
              </View>
            ))}
            <TouchableOpacity
              onPress={addIngredient}
              style={[styles.addIngredientRow, { borderTopColor: theme.divider }]}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Add ingredient"
            >
              <Text style={[theme.typography.body, { color: theme.accent }]}>+ Add ingredient</Text>
            </TouchableOpacity>
          </ListSection>

          <ListSection title="Optional" titleVariant="small" glass={false} style={styles.optionalSection}>
            <TextField
              label="Recipe URL"
              value={recipeUrl}
              onChangeText={setRecipeUrl}
              placeholder="https://..."
              autoCapitalize="none"
              keyboardType="url"
            />
            <TextField
              label="Tips"
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. Prep ahead, serve cold"
              multiline
            />
          </ListSection>

          <View style={[styles.formFooter, { borderTopColor: theme.divider }]}>
            <PrimaryButton
              title={isNew ? 'Create meal' : 'Save'}
              onPress={handleSave}
              loading={saving}
            />
          </View>
        </ScrollView>
      </KeyboardSafeForm>

      <MealTypeOptionsSheet
        visible={mealTypeSheetVisible}
        onClose={() => setMealTypeSheetVisible(false)}
        value={mealSlot}
        customSlotName={customSlotName}
        onSelect={setMealSlot}
      />
      {isNew ? (
        <MealWeekdayScheduleSheet
          visible={scheduleSheetVisible}
          onClose={() => setScheduleSheetVisible(false)}
          title="Schedule"
          subtitle="Choose weekdays. Dates are calculated from today."
          confirmLabel="Done"
          weekdays={scheduleWeekdays}
          onWeekdaysChange={setScheduleWeekdays}
          recurring={scheduleRecurring}
          onRecurringChange={setScheduleRecurring}
          recurringWeeks={scheduleRecurringWeeks}
          onRecurringWeeksChange={setScheduleRecurringWeeks}
          onConfirm={() => setScheduleSheetVisible(false)}
        />
      ) : null}

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
  basicsSection: { marginBottom: spacing.lg },
  titleField: { marginBottom: spacing.lg },
  group: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: spacing.md,
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
  ingSection: { marginBottom: spacing.lg },
  ingBlock: {
    paddingVertical: spacing.sm,
  },
  ingRow1: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  ingName: { flex: 1, marginBottom: 0, marginRight: spacing.sm },
  removeBtn: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: MIN_TOUCH_TARGET / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ingRow2: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ingQty: { width: 56, marginBottom: 0, flexShrink: 0 },
  ingUnitWrap: { width: 96, marginBottom: 0, flexShrink: 0 },
  ingUnit: { marginBottom: 0 },
  ingNote: { flex: 1, minWidth: 100, marginBottom: 0 },
  addIngredientRow: {
    minHeight: 48,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  customSlotField: { marginTop: spacing.sm },
  optionalSection: { marginBottom: spacing.lg },
  formFooter: {
    paddingHorizontal: 0,
    paddingTop: spacing.md,
    marginTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
