import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Keyboard,
  ActivityIndicator,
  Linking,
  type NativeSyntheticEvent,
  type TextInputContentSizeChangeEventData,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RecipesStackParamList } from '../../navigation/types';
import { useTheme } from '../../design/ThemeContext';
import { Screen } from '../../components/ui/Screen';
import { PushedScreenHeader } from '../../components/ui/PushedScreenHeader';
import { KeyboardSafeForm } from '../../components/ui/KeyboardSafeForm';
import { ListSection } from '../../components/ui/ListSection';
import { SecondaryButton } from '../../components/ui/SecondaryButton';
import { TextField } from '../../components/ui/TextField';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { UnitPickerSheet } from '../../components/ui/UnitPickerSheet';
import { normalizeUnitValue } from '../../components/ui/unitSelection';
import { AppConfirmationDialog } from '../../components/ui/AppConfirmationDialog';
import { RECIPE_CATEGORY_LABELS } from '../../components/recipes/RecipeCategorySheet';
import type { RecipeCategory } from '../../types/models';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUserId } from '../../services/supabaseClient';
import { queryKeys } from '../../query/keys';
import { fetchRecipeDetailBundle, RECIPE_DETAIL_STALE_MS } from '../../query/recipeDetailBundle';
import { createRecipe, getRecipes, setRecipeIngredients, updateRecipe } from '../../services/recipeService';
import { ensureFreeTierCapacity } from '../../services/freeTierLimits';
import { usePremiumEntitlement } from '../../context/PremiumEntitlementContext';
import { titleCaseWords } from '../../utils/titleCaseWords';
import { showError, showSuccess } from '../../utils/appToast';
import { MAX_RECIPE_AI_INPUT, MAX_RECIPE_INSTRUCTIONS, clampStr } from '../../constants/textLimits';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';
import { AI_RECIPE_IMPORT_DISCLOSURE_LEAD } from '../../constants/aiPrivacyDisclosure';
import { PRIVACY_POLICY_URL } from '../../constants/legalUrls';
import { parseRecipeInstructionSteps } from '../../utils/parseRecipeInstructionSteps';
import { mapParsedRecipeDraftToForm } from './recipeAiImport';
import { ensureAiFeatureAccess, commitAiTaste } from '../../services/aiFeatureTaste';
import { notifyMeaningfulListOrRecipeAction } from '../../services/engagementPaywallTriggers';
import { notifyFreeTierNearLimitIfNeeded } from '../../services/notifyFreeTierNearLimit';
import { notifyRecipeSavedForMilestones } from '../../firstLaunchTour/milestoneUnlockFlow';
import {
  RecipeAiImportOverlay,
  type RecipeAiImportMode,
  type RecipeAiImportPhase,
} from '../../components/recipes/RecipeAiImportOverlay';
import { useReduceMotion } from '../../ui/motion/useReduceMotion';
import { useHaptics } from '../../hooks/useHaptics';

type Route = RouteProp<RecipesStackParamList, 'RecipeEdit'>;

type IngredientRow = {
  name: string;
  quantity_value: string;
  quantity_unit: string;
  notes: string;
};

const defaultIngredient: IngredientRow = {
  name: '',
  quantity_value: '',
  quantity_unit: 'ea',
  notes: '',
};

const MIN_TOUCH_TARGET = 44;

type SmartImportTab = 'link' | 'paste';

const CATEGORY_CHIP_ORDER: { key: RecipeCategory | null; label: string }[] = [
  { key: 'breakfast', label: RECIPE_CATEGORY_LABELS.breakfast },
  { key: 'lunch', label: RECIPE_CATEGORY_LABELS.lunch },
  { key: 'dinner', label: RECIPE_CATEGORY_LABELS.dinner },
  { key: 'snack', label: RECIPE_CATEGORY_LABELS.snack },
  { key: 'dessert', label: RECIPE_CATEGORY_LABELS.dessert },
  { key: 'other', label: RECIPE_CATEGORY_LABELS.other },
  { key: null, label: 'None' },
];

type StepRow = { id: string; text: string };

function newStepId(): string {
  return `step_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function emptyStepRow(): StepRow {
  return { id: newStepId(), text: '' };
}

/** Single-line visual minimum until content measurement expands the field (matches touch target + TextField center math). */
const STEP_FIELD_MIN_HEIGHT = MIN_TOUCH_TARGET;

function instructionsFromSteps(rows: StepRow[]): string {
  return rows
    .map((r) => r.text.trim())
    .filter((t) => t.length > 0)
    .join('\n');
}

export function RecipeEditScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { isPremium, isPremiumLoading } = usePremiumEntitlement();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RecipesStackParamList>>();
  const route = useRoute<Route>();
  const recipeId = route.params?.recipeId;
  const isNew = !recipeId;
  const headerTitle = isNew ? 'New recipe' : 'Edit recipe';

  const [name, setName] = useState('');
  const [servings, setServings] = useState('4');
  const [category, setCategory] = useState<RecipeCategory | null>(null);
  const [recipeUrl, setRecipeUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [steps, setSteps] = useState<StepRow[]>(() => [emptyStepRow()]);
  const [stepHeights, setStepHeights] = useState<Record<string, number>>({});
  const [totalTimeMinutes, setTotalTimeMinutes] = useState('');
  const [ingredients, setIngredients] = useState<IngredientRow[]>([{ ...defaultIngredient }]);
  const [saving, setSaving] = useState(false);
  const [unitPickerIdx, setUnitPickerIdx] = useState<number | null>(null);

  const [smartImportTab, setSmartImportTab] = useState<SmartImportTab>('link');
  const [importLinkUrl, setImportLinkUrl] = useState('');
  const [importPasteText, setImportPasteText] = useState('');
  const [aiImportOverlay, setAiImportOverlay] = useState<{
    phase: RecipeAiImportPhase;
    mode: RecipeAiImportMode;
    progress?: number;
    errorMessage?: string;
  } | null>(null);
  const importAbortRef = useRef<AbortController | null>(null);
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);
  const reduceMotion = useReduceMotion();
  const haptics = useHaptics();

  const lastHydratedRecipeIdRef = useRef<string | null>(null);

  const applyParsedDraft = useCallback((mapped: ReturnType<typeof mapParsedRecipeDraftToForm>) => {
    setName(mapped.name);
    setServings(mapped.servings.trim() ? mapped.servings : '4');
    setTotalTimeMinutes(mapped.totalTimeMinutes);
    setCategory(mapped.category);
    const parsedSteps = parseRecipeInstructionSteps(mapped.instructions);
    setSteps(
      parsedSteps.length > 0 ? parsedSteps.map((text) => ({ id: newStepId(), text })) : [emptyStepRow()]
    );
    setStepHeights({});
    setNotes(mapped.notes);
    setRecipeUrl(mapped.recipeUrl);
    setIngredients(mapped.ingredients.length > 0 ? mapped.ingredients : [{ ...defaultIngredient }]);
  }, []);

  const detailQuery = useQuery({
    queryKey: queryKeys.recipeDetail(recipeId ?? ''),
    queryFn: () => fetchRecipeDetailBundle(recipeId!),
    enabled: Boolean(!isNew && recipeId),
    staleTime: RECIPE_DETAIL_STALE_MS,
  });

  useEffect(() => {
    lastHydratedRecipeIdRef.current = null;
  }, [recipeId]);

  useEffect(() => {
    if (isNew || !recipeId || !detailQuery.data) return;
    if (lastHydratedRecipeIdRef.current === recipeId) return;
    lastHydratedRecipeIdRef.current = recipeId;
    const { recipe, ingredients: ings } = detailQuery.data;
    setName(recipe.name);
    setServings(String(recipe.servings));
    setCategory(recipe.category ?? null);
    setRecipeUrl(recipe.recipe_url ?? '');
    setNotes(recipe.notes ?? '');
    const parsedSteps = parseRecipeInstructionSteps(recipe.instructions);
    setSteps(
      parsedSteps.length > 0 ? parsedSteps.map((text) => ({ id: newStepId(), text })) : [emptyStepRow()]
    );
    setStepHeights({});
    setTotalTimeMinutes(
      recipe.total_time_minutes != null && recipe.total_time_minutes > 0
        ? String(recipe.total_time_minutes)
        : ''
    );
    setIngredients(
      ings.length > 0
        ? ings.map((i) => ({
            name: i.name,
            quantity_value: i.quantity_value != null ? String(i.quantity_value) : '',
            quantity_unit: i.quantity_unit ?? 'ea',
            notes: i.notes ?? '',
          }))
        : [{ ...defaultIngredient }]
    );
  }, [isNew, recipeId, detailQuery.data]);

  useEffect(() => {
    if (!isNew && detailQuery.isError) {
      showError('Could not load recipe.');
    }
  }, [isNew, detailQuery.isError]);

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

  const addStep = () => {
    const row = emptyStepRow();
    setSteps((prev) => [...prev, row]);
  };

  const removeStep = (id: string) => {
    setSteps((prev) => {
      const next = prev.filter((r) => r.id !== id);
      return next.length > 0 ? next : [emptyStepRow()];
    });
    setStepHeights((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  };

  const updateStep = (id: string, value: string) => {
    setSteps((prev) => prev.map((r) => (r.id === id ? { ...r, text: value } : r)));
  };

  const onStepContentSizeChange = useCallback(
    (stepId: string, text: string) => (e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
      let ch = e.nativeEvent.contentSize.height;
      // iOS: empty multiline TextInputs often report a huge intrinsic height; cap so the row stays short.
      if (!text.trim()) {
        ch = Math.min(ch, 32);
      } else {
        ch = Math.min(ch, 2000);
      }
      const pad = 14;
      const next = Math.min(360, Math.max(STEP_FIELD_MIN_HEIGHT, Math.ceil(ch + pad)));
      setStepHeights((prev) => (prev[stepId] === next ? prev : { ...prev, [stepId]: next }));
    },
    []
  );

  const handleSave = async () => {
    Keyboard.dismiss();

    const userId = await getUserId();
    if (!userId) {
      setErrorDialog({ title: 'Error', message: 'You must be signed in to save a recipe.' });
      return;
    }

    let instructions = instructionsFromSteps(steps);
    if (instructions.length > MAX_RECIPE_INSTRUCTIONS) {
      instructions = clampStr(instructions, MAX_RECIPE_INSTRUCTIONS);
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
            quantity_value,
            quantity_unit: i.quantity_unit.trim() || null,
            notes: i.notes.trim() || null,
          };
        });

      const recipeTitle = name.trim() ? titleCaseWords(name.trim()) : 'Untitled recipe';

      let total_time_minutes: number | null = null;
      const tm = totalTimeMinutes.trim();
      if (tm) {
        const n = parseInt(tm, 10);
        if (!Number.isNaN(n) && n >= 0) total_time_minutes = n;
      }

      if (isNew) {
        const existingRecipes = isPremium ? [] : await getRecipes(userId);
        const allowed = await ensureFreeTierCapacity('recipe', existingRecipes.length, 1, isPremium, isPremiumLoading);
        if (!allowed) {
          setSaving(false);
          return;
        }

        const r = await createRecipe(userId, {
          name: recipeTitle,
          servings: parseInt(servings, 10) || 4,
          category: category,
          recipe_url: recipeUrl.trim() || null,
          notes: notes.trim() || null,
          instructions: instructions.trim() || null,
          total_time_minutes,
        });
        await setRecipeIngredients(r.id, ings);
        void queryClient.invalidateQueries({ queryKey: queryKeys.recipesScreenRoot(userId) });
        notifyMeaningfulListOrRecipeAction();
        notifyRecipeSavedForMilestones();
        void notifyFreeTierNearLimitIfNeeded('recipe', existingRecipes.length + 1);
        navigation.replace('RecipeDetails', { recipeId: r.id });
      } else {
        await updateRecipe(recipeId!, {
          name: recipeTitle,
          servings: parseInt(servings, 10) || 4,
          category: category,
          recipe_url: recipeUrl.trim() || null,
          notes: notes.trim() || null,
          instructions: instructions.trim() || null,
          total_time_minutes,
        });
        await setRecipeIngredients(recipeId!, ings);
        void queryClient.invalidateQueries({ queryKey: queryKeys.recipesScreenRoot(userId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.recipeDetail(recipeId!) });
        showSuccess('Recipe updated.');
        navigation.goBack();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setErrorDialog({ title: 'Could not save', message });
    } finally {
      setSaving(false);
    }
  };

  const dismissAiImport = useCallback(() => {
    importAbortRef.current?.abort();
    importAbortRef.current = null;
    setAiImportOverlay(null);
  }, []);

  const handleImportFromLink = async () => {
    const raw = importLinkUrl.trim();
    if (!raw) {
      setErrorDialog({ title: 'Missing URL', message: 'Paste a link first, then tap Import.' });
      return;
    }

    const gate = await ensureAiFeatureAccess('recipe_import', 'recipe_url', isPremium, isPremiumLoading);
    if (!gate.allowed) return;

    importAbortRef.current?.abort();
    const ac = new AbortController();
    importAbortRef.current = ac;
    const invokeOpts = {
      premiumHint: { isPremium, isLoading: isPremiumLoading },
      signal: ac.signal,
    };

    setAiImportOverlay({ phase: 'parsing', mode: 'link', progress: 0.1 });
    try {
      const [{ parseRecipeFromUrl }, { mapParsedRecipeDraftToForm: mapDraft }] = await Promise.all([
        import('../../services/aiService'),
        import('./recipeAiImport'),
      ]);
      setAiImportOverlay({ phase: 'parsing', mode: 'link', progress: 0.35 });
      const { recipe, cache_hit } = await parseRecipeFromUrl(raw, invokeOpts);
      setAiImportOverlay({
        phase: 'parsing',
        mode: 'link',
        progress: cache_hit ? 0.95 : 0.75,
      });
      const mapped = mapDraft(recipe);
      applyParsedDraft(mapped);
      if (gate.usesFreeAllowance) await commitAiTaste('recipe_import');
      setAiImportOverlay({ phase: 'success', mode: 'link', progress: 1 });
      haptics.success();
    } catch (err) {
      if (err instanceof Error && err.message === 'Cancelled.') {
        setAiImportOverlay(null);
        return;
      }
      const message = err instanceof Error ? err.message : 'Could not import from that link. Try again.';
      setAiImportOverlay({ phase: 'failure', mode: 'link', errorMessage: message });
    } finally {
      importAbortRef.current = null;
    }
  };

  const handleExtractFromPaste = async () => {
    const raw = importPasteText.trim();
    if (!raw) {
      setErrorDialog({ title: 'Missing recipe text', message: 'Paste recipe text first, then tap Extract.' });
      return;
    }

    const gate = await ensureAiFeatureAccess('recipe_import', 'recipe_paste', isPremium, isPremiumLoading);
    if (!gate.allowed) return;

    importAbortRef.current?.abort();
    const ac = new AbortController();
    importAbortRef.current = ac;
    const invokeOpts = {
      premiumHint: { isPremium, isLoading: isPremiumLoading },
      signal: ac.signal,
    };

    setAiImportOverlay({ phase: 'parsing', mode: 'paste', progress: 0.1 });
    try {
      const [{ parseRecipeFromText }, { mapParsedRecipeDraftToForm: mapDraft }] = await Promise.all([
        import('../../services/aiService'),
        import('./recipeAiImport'),
      ]);
      setAiImportOverlay({ phase: 'parsing', mode: 'paste', progress: 0.4 });
      const { recipe, cache_hit } = await parseRecipeFromText(raw, invokeOpts);
      setAiImportOverlay({
        phase: 'parsing',
        mode: 'paste',
        progress: cache_hit ? 0.95 : 0.75,
      });
      const mapped = mapDraft(recipe);
      applyParsedDraft(mapped);
      if (gate.usesFreeAllowance) await commitAiTaste('recipe_import');
      setAiImportOverlay({ phase: 'success', mode: 'paste', progress: 1 });
      haptics.success();
    } catch (err) {
      if (err instanceof Error && err.message === 'Cancelled.') {
        setAiImportOverlay(null);
        return;
      }
      const message = err instanceof Error ? err.message : 'Couldn’t read that recipe. Try again.';
      setAiImportOverlay({ phase: 'failure', mode: 'paste', errorMessage: message });
    } finally {
      importAbortRef.current = null;
    }
  };

  const editLoadBlocking = !isNew && detailQuery.isPending && !detailQuery.data;

  const savePill = (
    <TouchableOpacity
      onPress={handleSave}
      disabled={saving || !name.trim()}
      style={[
        styles.savePill,
        {
          backgroundColor: name.trim() ? theme.accent : theme.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: name.trim() ? theme.accent : theme.divider,
          opacity: saving ? 0.85 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={isNew ? 'Create recipe' : 'Save recipe'}
      accessibilityState={{ disabled: saving || !name.trim() }}
    >
      {saving ? (
        <ActivityIndicator color={theme.onAccent} size="small" />
      ) : (
        <Text
          style={[
            theme.typography.subhead,
            {
              color: name.trim() ? theme.onAccent : theme.textSecondary,
              fontWeight: '600',
            },
          ]}
        >
          Save
        </Text>
      )}
    </TouchableOpacity>
  );

  if (editLoadBlocking) {
    return (
      <Screen padded safeTop={false} safeBottom={false}>
        <PushedScreenHeader title={headerTitle} onBack={() => navigation.goBack()} />
        <View style={styles.centeredLoader}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded safeTop={false} safeBottom={false}>
      <PushedScreenHeader title={headerTitle} onBack={() => navigation.goBack()} rightAccessory={savePill} />
      <KeyboardSafeForm style={styles.keyboard}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            {
              paddingBottom: insets.bottom + theme.spacing.xxl,
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {isNew ? (
            <ListSection title="Smart import" titleVariant="small" glass={false} style={styles.smartImportSection}>
              <SegmentedControl
                segments={[
                  { key: 'link', label: 'Paste link' },
                  { key: 'paste', label: 'Paste recipe' },
                ]}
                value={smartImportTab}
                onChange={(value) => {
                  setSmartImportTab(value);
                }}
              />
              {smartImportTab === 'link' ? (
                <View style={styles.smartImportBody}>
                  <TextField
                    label="Recipe URL"
                    value={importLinkUrl}
                    onChangeText={setImportLinkUrl}
                    placeholder="https://..."
                    autoCapitalize="none"
                    keyboardType="url"
                    containerStyle={styles.smartImportField}
                    style={styles.compactLineInput}
                  />
                  <SecondaryButton
                    title="Import"
                    onPress={handleImportFromLink}
                    disabled={!importLinkUrl.trim() || aiImportOverlay != null}
                    style={styles.smartImportAction}
                  />
                </View>
              ) : (
                <View style={styles.smartImportBody}>
                  <TextField
                    label="Paste full recipe text"
                    value={importPasteText}
                    onChangeText={setImportPasteText}
                    placeholder={'Recipe title\n\nIngredients:\n- 2 eggs\n...\n\nInstructions:\n1. ...'}
                    multiline
                    maxLength={MAX_RECIPE_AI_INPUT}
                    scrollEnabled
                    textAlignVertical="top"
                    style={styles.pasteTextInput}
                    containerStyle={styles.smartImportField}
                  />
                  <SecondaryButton
                    title="Extract"
                    onPress={handleExtractFromPaste}
                    disabled={!importPasteText.trim() || aiImportOverlay != null}
                    style={styles.smartImportAction}
                  />
                  <Text
                    style={[
                      theme.typography.footnote,
                      { color: theme.textSecondary, lineHeight: 20, marginTop: theme.spacing.sm },
                    ]}
                  >
                    {AI_RECIPE_IMPORT_DISCLOSURE_LEAD}{' '}
                    <Text
                      onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
                      style={{ color: theme.accent }}
                      accessibilityRole="link"
                      accessibilityLabel="Open privacy policy"
                    >
                      Privacy policy
                    </Text>
                    .
                  </Text>
                </View>
              )}
            </ListSection>
          ) : null}

          <ListSection title="Basics" titleVariant="small" glass={false} style={styles.basicsSection}>
            <TextField
              label="Recipe name"
              value={name}
              onChangeText={setName}
              placeholder="Recipe name"
              containerStyle={styles.titleField}
              style={styles.compactLineInput}
              formatOnBlur="titleWords"
            />
            <View style={styles.twoColRow}>
              <TextField
                label="Servings"
                value={servings}
                onChangeText={setServings}
                placeholder="4"
                keyboardType="number-pad"
                containerStyle={styles.twoColField}
                style={styles.compactLineInput}
              />
              <TextField
                label="Total time (minutes)"
                value={totalTimeMinutes}
                onChangeText={setTotalTimeMinutes}
                placeholder="Min"
                keyboardType="number-pad"
                containerStyle={styles.twoColField}
                style={styles.compactLineInput}
              />
            </View>
            <Text
              style={[
                theme.typography.caption1,
                { color: theme.textSecondary, textTransform: 'uppercase', marginBottom: theme.spacing.sm },
              ]}
            >
              Category
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
              keyboardShouldPersistTaps="handled"
            >
              {CATEGORY_CHIP_ORDER.map((opt) => {
                const selected = category === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key === null ? 'none' : opt.key}
                    onPress={() => setCategory(opt.key)}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: selected ? theme.accent : theme.surface,
                        borderColor: selected ? theme.accent : theme.divider,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Category ${opt.label}`}
                  >
                    <Text
                      style={[
                        theme.typography.subhead,
                        { color: selected ? theme.onAccent : theme.textPrimary, fontWeight: '600' },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </ListSection>

          <ListSection
            title="Ingredients"
            titleVariant="small"
            glass={false}
            style={styles.ingSection}
            headerRight={
              <TouchableOpacity
                onPress={addIngredient}
                style={styles.sectionHeaderBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Add ingredient"
              >
                <Text style={[theme.typography.subhead, { color: theme.accent, fontWeight: '600' }]}>
                  + Add
                </Text>
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
                <TextField
                  value={ing.name}
                  onChangeText={(v) => updateIngredient(idx, 'name', v)}
                  placeholder="Name"
                  accessibilityLabel="Ingredient name"
                  containerStyle={styles.ingName}
                  style={styles.compactLineInput}
                  formatOnBlur="titleWords"
                />
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

          <ListSection
            title="Steps"
            titleVariant="small"
            glass={false}
            style={styles.stepsSection}
            headerRight={
              <TouchableOpacity
                onPress={addStep}
                style={styles.sectionHeaderBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Add step"
              >
                <Text style={[theme.typography.subhead, { color: theme.accent, fontWeight: '600' }]}>
                  + Add
                </Text>
              </TouchableOpacity>
            }
          >
            {steps.map((row, idx) => (
              <View
                key={row.id}
                style={[
                  styles.stepRow,
                  idx < steps.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: theme.divider,
                    paddingBottom: theme.spacing.sm,
                    marginBottom: theme.spacing.sm,
                  },
                ]}
              >
                <View
                  style={[
                    styles.stepNumberCircle,
                    {
                      backgroundColor: theme.surface,
                      borderWidth: 2,
                      borderColor: theme.accent,
                    },
                  ]}
                >
                  <Text style={[theme.typography.subhead, { color: theme.accent, fontWeight: '700' }]}>
                    {idx + 1}
                  </Text>
                </View>
                <TextField
                  inputVariant="shrinkWrap"
                  value={row.text}
                  onChangeText={(v) => updateStep(row.id, v)}
                  placeholder="Step…"
                  multiline
                  multilineVerticalAlign="center"
                  multilineCenterMinHeight={STEP_FIELD_MIN_HEIGHT}
                  scrollEnabled={false}
                  onContentSizeChange={onStepContentSizeChange(row.id, row.text)}
                  style={[
                    styles.stepInput,
                    {
                      height: stepHeights[row.id] ?? STEP_FIELD_MIN_HEIGHT,
                      maxHeight: 360,
                    },
                  ]}
                  containerStyle={styles.stepField}
                />
                <TouchableOpacity
                  onPress={() => removeStep(row.id)}
                  style={[styles.removeBtn, { backgroundColor: theme.surface }]}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove step ${idx + 1}`}
                >
                  <Ionicons name="close-outline" size={24} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            ))}
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

      <AppConfirmationDialog
        visible={!!errorDialog}
        onClose={() => setErrorDialog(null)}
        title={errorDialog?.title ?? ''}
        message={errorDialog?.message}
        buttons={[{ label: 'OK', onPress: () => setErrorDialog(null) }]}
        allowBackdropDismiss
      />

      <RecipeAiImportOverlay
        visible={aiImportOverlay != null}
        phase={aiImportOverlay?.phase ?? 'parsing'}
        mode={aiImportOverlay?.mode ?? 'link'}
        progressFraction={aiImportOverlay?.progress}
        errorMessage={aiImportOverlay?.errorMessage}
        onDismiss={() => {
          if (aiImportOverlay?.phase === 'parsing') {
            dismissAiImport();
          } else {
            setAiImportOverlay(null);
          }
        }}
        onCancel={aiImportOverlay?.phase === 'parsing' ? dismissAiImport : undefined}
        reduceMotion={reduceMotion}
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
    minWidth: 72,
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  smartImportSection: { marginBottom: spacing.lg },
  smartImportBody: { marginTop: spacing.sm },
  smartImportField: { marginBottom: spacing.sm },
  smartImportAction: { marginBottom: spacing.xs },
  pasteTextInput: { minHeight: 160 },
  basicsSection: { marginBottom: spacing.lg },
  titleField: { marginBottom: spacing.md },
  twoColRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  twoColField: { flex: 1, marginBottom: 0, minWidth: 0 },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  categoryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  ingSection: { marginBottom: spacing.lg },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ingQty: { width: spacing.md * 5, marginBottom: 0, flexShrink: 0 },
  /** Single-line inputs: same rhythm as unit dropdown trigger (44pt min, sm vertical padding). */
  compactLineInput: {
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: spacing.sm,
  },
  ingQtyInput: { paddingHorizontal: spacing.xs },
  ingUnitWrap: { width: 96, marginBottom: 0, flexShrink: 0 },
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
  ingName: { flex: 1, minWidth: 0, marginBottom: 0 },
  removeBtn: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: MIN_TOUCH_TARGET / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepsSection: { marginBottom: spacing.lg },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepNumberCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepField: { flex: 1, minWidth: 0, marginBottom: 0 },
  stepInput: { paddingVertical: spacing.xs },
  sectionHeaderBtn: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
});
