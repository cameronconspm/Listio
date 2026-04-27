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
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RecipesStackParamList } from '../../navigation/types';
import { useTheme } from '../../design/ThemeContext';
import { useScrollContentInsetTop } from '../../ui/chrome/useScrollContentInsetTop';
import { Screen } from '../../components/ui/Screen';
import { KeyboardSafeForm } from '../../components/ui/KeyboardSafeForm';
import { ListSection } from '../../components/ui/ListSection';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { SecondaryButton } from '../../components/ui/SecondaryButton';
import { TextField } from '../../components/ui/TextField';
import { AppSelectField } from '../../components/ui/AppSelectField';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { UnitDropdown } from '../../components/ui/UnitDropdown';
import { AppConfirmationDialog } from '../../components/ui/AppConfirmationDialog';
import { RecipeCategorySheet, RECIPE_CATEGORY_LABELS } from '../../components/recipes/RecipeCategorySheet';
import type { RecipeCategory } from '../../types/models';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUserId } from '../../services/supabaseClient';
import { queryKeys } from '../../query/keys';
import { fetchRecipeDetailBundle, RECIPE_DETAIL_STALE_MS } from '../../query/recipeDetailBundle';
import { createRecipe, setRecipeIngredients, updateRecipe } from '../../services/recipeService';
import { titleCaseWords } from '../../utils/titleCaseWords';
import { showError, showSuccess } from '../../utils/appToast';
import { MAX_RECIPE_AI_INPUT, MAX_RECIPE_INSTRUCTIONS } from '../../constants/textLimits';
import { spacing } from '../../design/spacing';
import { AI_RECIPE_IMPORT_DISCLOSURE_LEAD } from '../../constants/aiPrivacyDisclosure';
import { PRIVACY_POLICY_URL } from '../../constants/legalUrls';

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
type EntryMode = 'manual' | 'ai';

export function RecipeEditScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const scrollContentInsetTop = useScrollContentInsetTop();
  const navigation = useNavigation<NativeStackNavigationProp<RecipesStackParamList>>();
  const route = useRoute<Route>();
  const recipeId = route.params?.recipeId;
  const isNew = !recipeId;

  const [name, setName] = useState('');
  const [servings, setServings] = useState('4');
  const [category, setCategory] = useState<RecipeCategory | null>(null);
  const [categorySheetVisible, setCategorySheetVisible] = useState(false);
  const [recipeUrl, setRecipeUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [instructions, setInstructions] = useState('');
  const [totalTimeMinutes, setTotalTimeMinutes] = useState('');
  const [ingredients, setIngredients] = useState<IngredientRow[]>([{ ...defaultIngredient }]);
  const [saving, setSaving] = useState(false);
  const [entryMode, setEntryMode] = useState<EntryMode>('manual');
  const [aiRecipeText, setAiRecipeText] = useState('');
  const [isParsingAi, setIsParsingAi] = useState(false);
  const [aiParseStatus, setAiParseStatus] = useState<string | null>(null);
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);

  const lastHydratedRecipeIdRef = useRef<string | null>(null);

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
    setInstructions(recipe.instructions ?? '');
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
      setErrorDialog({ title: 'Error', message: 'You must be signed in to save a recipe.' });
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
        showSuccess('Recipe created.');
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

  const handleParseAiRecipe = async () => {
    const raw = aiRecipeText.trim();
    if (!raw) {
      setErrorDialog({ title: 'Missing recipe text', message: 'Paste recipe text first, then parse.' });
      return;
    }

    setIsParsingAi(true);
    setAiParseStatus(null);
    try {
      const [{ parseRecipeFromText }, { mapParsedRecipeDraftToForm }] = await Promise.all([
        import('../../services/aiService'),
        import('./recipeAiImport'),
      ]);
      const { recipe, cache_hit } = await parseRecipeFromText(raw);
      const mapped = mapParsedRecipeDraftToForm(recipe);
      setName(mapped.name);
      setServings(mapped.servings.trim() ? mapped.servings : '4');
      setTotalTimeMinutes(mapped.totalTimeMinutes);
      setCategory(mapped.category);
      setInstructions(mapped.instructions);
      setNotes(mapped.notes);
      setRecipeUrl(mapped.recipeUrl);
      setIngredients(mapped.ingredients.length > 0 ? mapped.ingredients : [{ ...defaultIngredient }]);
      setEntryMode('manual');
      setAiParseStatus(
        cache_hit ? 'Recipe parsed from cache. Review and tap Create recipe.' : 'Recipe parsed. Review and tap Create recipe.'
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not parse recipe text. Try again.';
      setErrorDialog({ title: 'Could not parse recipe', message });
    } finally {
      setIsParsingAi(false);
    }
  };

  const editLoadBlocking = !isNew && detailQuery.isPending && !detailQuery.data;

  if (editLoadBlocking) {
    return (
      <Screen padded safeTop={false} safeBottom={false}>
        <View style={[styles.centeredLoader, { paddingTop: scrollContentInsetTop }]}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      </Screen>
    );
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
              paddingBottom: insets.bottom + theme.spacing.xxl,
            },
          ]}
          contentInsetAdjustmentBehavior={Platform.OS === 'ios' ? 'never' : undefined}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {isNew ? (
            <ListSection title="Entry mode" titleVariant="small" glass={false} style={styles.modeSection}>
              <SegmentedControl
                segments={[
                  { key: 'manual', label: 'Manual' },
                  { key: 'ai', label: 'AI Paste' },
                ]}
                value={entryMode}
                onChange={(value) => {
                  setEntryMode(value);
                  setAiParseStatus(null);
                }}
              />
            </ListSection>
          ) : null}

          {isNew && entryMode === 'ai' ? (
            <ListSection title="AI recipe import" titleVariant="small" glass={false} style={styles.aiSection}>
              <TextField
                label="Paste full recipe text"
                value={aiRecipeText}
                onChangeText={setAiRecipeText}
                placeholder={'Recipe title\n\nIngredients:\n- 2 eggs\n...\n\nInstructions:\n1. ...'}
                multiline
                maxLength={MAX_RECIPE_AI_INPUT}
                scrollEnabled
                textAlignVertical="top"
                style={styles.aiTextInput}
                containerStyle={styles.aiTextField}
              />
              <SecondaryButton
                title="Parse with AI"
                onPress={handleParseAiRecipe}
                loading={isParsingAi}
                disabled={!aiRecipeText.trim()}
                style={styles.aiParseBtn}
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
              {aiParseStatus ? (
                <Text
                  style={[
                    theme.typography.footnote,
                    { color: theme.textSecondary, marginTop: theme.spacing.xs },
                  ]}
                >
                  {aiParseStatus}
                </Text>
              ) : null}
            </ListSection>
          ) : null}

          <ListSection title="Basics" titleVariant="small" glass={false} style={styles.basicsSection}>
            <TextField
              label="Recipe name"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Pasta carbonara"
              containerStyle={styles.titleField}
              formatOnBlur="titleWords"
            />
            <TextField
              label="Servings"
              value={servings}
              onChangeText={setServings}
              placeholder="4"
              keyboardType="number-pad"
            />
            <TextField
              label="Total time (minutes)"
              value={totalTimeMinutes}
              onChangeText={setTotalTimeMinutes}
              placeholder="e.g. 30"
              keyboardType="number-pad"
              containerStyle={styles.timeField}
            />
            <AppSelectField
              label="Category"
              value={category ? RECIPE_CATEGORY_LABELS[category] : ''}
              onPress={() => setCategorySheetVisible(true)}
              placeholder="None"
              containerStyle={styles.categoryField}
              accessibilityLabel="Recipe category"
            />
          </ListSection>

          <ListSection title="Instructions" titleVariant="small" glass={false} style={styles.instructionsSection}>
            <TextField
              label="Step-by-step"
              value={instructions}
              onChangeText={setInstructions}
              placeholder={'One step per line.\n\nBoil salted water.\nCook pasta until al dente.'}
              multiline
              maxLength={MAX_RECIPE_INSTRUCTIONS}
              scrollEnabled
              textAlignVertical="top"
              style={styles.instructionsInput}
              containerStyle={styles.instructionsField}
            />
          </ListSection>

          <ListSection title="Ingredients" titleVariant="small" glass={false} style={styles.ingSection}>
            {ingredients.map((ing, idx) => (
              <View
                key={idx}
                style={[
                  styles.ingBlock,
                  idx < ingredients.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: theme.divider,
                  },
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
              placeholder="e.g. Prep ahead, serve cold, substitutions"
              multiline
            />
          </ListSection>

          <View style={[styles.formFooter, { borderTopColor: theme.divider }]}>
            <PrimaryButton
              title={isNew ? 'Create recipe' : 'Save'}
              onPress={handleSave}
              loading={saving}
            />
          </View>
        </ScrollView>
      </KeyboardSafeForm>

      <RecipeCategorySheet
        visible={categorySheetVisible}
        onClose={() => setCategorySheetVisible(false)}
        value={category}
        onSelect={setCategory}
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
  modeSection: { marginBottom: spacing.lg },
  aiSection: { marginBottom: spacing.lg },
  aiTextField: { marginBottom: spacing.sm },
  aiTextInput: { minHeight: 180 },
  aiParseBtn: { marginBottom: spacing.sm },
  basicsSection: { marginBottom: spacing.lg },
  titleField: { marginBottom: spacing.lg },
  timeField: { marginBottom: 0 },
  categoryField: { marginTop: spacing.md },
  instructionsSection: { marginBottom: spacing.lg },
  instructionsField: { marginBottom: 0 },
  instructionsInput: {
    minHeight: 160,
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
  optionalSection: { marginBottom: spacing.lg },
  formFooter: {
    paddingHorizontal: 0,
    paddingTop: spacing.md,
    marginTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
