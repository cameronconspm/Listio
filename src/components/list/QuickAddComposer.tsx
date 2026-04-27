import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useMemo,
} from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  Keyboard,
  Platform,
  UIManager,
  LayoutAnimation,
  useWindowDimensions,
  ScrollView as RNScrollView,
  StyleSheet,
} from 'react-native';
import { ScrollView, Pressable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet } from '../ui/BottomSheet';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/ThemeContext';
import { PrimaryButton } from '../ui/PrimaryButton';
import { AppConfirmationDialog } from '../ui/AppConfirmationDialog';
import { useHaptics } from '../../hooks/useHaptics';
import { parseItems, parseSingleEntry, parseBulkToItems, type ParsedItem } from '../../utils/parseItems';
import { titleCaseWords } from '../../utils/titleCaseWords';
import { UNITS, type Unit } from '../../data/units';
import { TextField } from '../ui/TextField';
import { useRecentSuggestions } from '../../hooks/useRecentSuggestions';
import type { ListItem, ZoneKey } from '../../types/models';
import { ZONE_LABELS } from '../../data/zone';
import { ListItemZonePickerPanel } from './ListItemZoneSheet';
import { createQuickAddComposerStyles } from './quickAddComposerStyles';
import { UnitSelectionList } from '../ui/UnitSelectionList';
import { duration } from '../../ui/motion/tokens';
import { parseListItemsFromText, categorizeItems } from '../../services/aiService';
import type { ParsedListItem } from '../../types/api';
import { AI_SMART_CATEGORIZATION_DISCLOSURE_LEAD } from '../../constants/aiPrivacyDisclosure';

export interface QuickAddComposerHandle {
  focus: () => void;
}

type QuickAddComposerProps = {
  visible: boolean;
  onDismiss: () => void;
  /** `zoneOverride` null = use AI-suggested section; set = force that section. */
  onSubmit: (items: ParsedItem[], zoneOverride: ZoneKey | null) => Promise<void>;
  editingItem?: ListItem | null;
  onEdit?: (id: string, parsed: ParsedItem, zoneKey: ZoneKey) => Promise<void>;
  /** Store layout order for the section picker. */
  zoneOrderForPicker?: ZoneKey[];
  /** Called after the sheet modal exit animation completes (see `BottomSheet` `onDismissed`). */
  onSheetDismissed?: () => void;
  /**
   * Bulk-insert pre-categorized items from Smart Add. Called after the user confirms the
   * "Add N items to your list?" alert; items already have `zone_key` + `category` resolved
   * so the host must NOT re-run categorization (it would cost a second round-trip and could
   * disagree with what the user just saw). When omitted, the sparkle toggle is hidden.
   */
  onBulkAddPreCategorized?: (items: ParsedListItem[]) => Promise<void>;
  /** Store type passed to the AI parser for zone suggestions (e.g. 'kroger_style'). */
  storeType?: string;
  /** Zone labels (display strings) in store layout order, for AI zone suggestions. */
  zoneLabelsInOrder?: string[];
};

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export const QuickAddComposer = forwardRef(
  function QuickAddComposer(
    {
      visible,
      onDismiss,
      onSubmit,
      editingItem = null,
      onEdit,
      zoneOrderForPicker,
      onSheetDismissed,
      onBulkAddPreCategorized,
      storeType,
      zoneLabelsInOrder,
    }: QuickAddComposerProps,
    ref: React.ForwardedRef<QuickAddComposerHandle>
  ) {
    const theme = useTheme();
    const styles = useMemo(() => createQuickAddComposerStyles(theme), [theme]);
    const CTA_GUTTER_PX = theme.spacing.sm;
    const insets = useSafeAreaInsets();
    const { height: windowHeight } = useWindowDimensions();
    const haptics = useHaptics();
    const inputRef = useRef<TextInput>(null);

    const [text, setText] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [unit, setUnit] = useState('ea');
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [addItemsDialogVisible, setAddItemsDialogVisible] = useState(false);
    const [addItemsDialogItems, setAddItemsDialogItems] = useState<ParsedItem[] | null>(null);
    const [brandPreference, setBrandPreference] = useState('');
    const [detailsExpanded, setDetailsExpanded] = useState(false);
    /** Add flow: null = Auto (AI section). */
    const [zoneOverride, setZoneOverride] = useState<ZoneKey | null>(null);
    const [editZoneKey, setEditZoneKey] = useState<ZoneKey>('other');
    const [zoneSheetVisible, setZoneSheetVisible] = useState(false);
    const [unitSheetVisible, setUnitSheetVisible] = useState(false);
    /**
     * Smart Add: AI-parses natural language ("a gallon of milk, two pounds of chicken")
     * into structured rows. Only available when `onBulkAddPreCategorized` is wired and we
     * aren't editing an existing item. Toggled by the sparkle icon next to the text field.
     */
    const [smartMode, setSmartMode] = useState(false);
    const [smartBusy, setSmartBusy] = useState(false);
    const smartParseAbortRef = useRef<{ cancelled: boolean } | null>(null);
    const smartAvailable = !editingItem && !!onBulkAddPreCategorized;

    /**
     * Pre-warm token for the typing-time categorize call. Flipping `cancelled = true`
     * discards the result if the user kept typing or dismissed before OpenAI returned.
     */
    const prewarmAbortRef = useRef<{ cancelled: boolean } | null>(null);

    const isFocused = useRef(false);
    const draftRef = useRef({
      text: '',
      quantity: 1,
      unit: 'ea',
      note: '',
      brandPreference: '',
    });
    const recentSuggestions = useRecentSuggestions(visible, text, editingItem);

    /**
     * Footer uses stable bottom padding (safe area + CTA gutter). Do not tie padding to keyboard
     * visibility — that re-rendered mid-dismiss and fought KAV + sheet exit motion.
     * KeyboardAvoidingView positions the sheet; the footer does not need to animate separately.
     */

    const focus = useCallback(() => {
      inputRef.current?.focus();
    }, []);

    useImperativeHandle(ref, () => ({ focus }), [focus]);

    const animateLayout = useCallback(() => {
      LayoutAnimation.configureNext({
        duration: duration.fast,
        create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
        update: { type: LayoutAnimation.Types.easeInEaseOut },
        delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      });
    }, []);

    const expandDetails = useCallback(() => {
      setDetailsExpanded((was) => {
        if (!was) {
          animateLayout();
          return true;
        }
        return was;
      });
    }, [animateLayout]);

    const toggleDetails = useCallback(() => {
      animateLayout();
      setDetailsExpanded((v) => !v);
    }, [animateLayout]);

    useEffect(() => {
      if (!visible) {
        setZoneSheetVisible(false);
        setUnitSheetVisible(false);
        setSmartBusy(false);
        if (smartParseAbortRef.current) {
          smartParseAbortRef.current.cancelled = true;
          smartParseAbortRef.current = null;
        }
        if (prewarmAbortRef.current) {
          prewarmAbortRef.current.cancelled = true;
          prewarmAbortRef.current = null;
        }
        return;
      }

      if (editingItem) {
        setSmartMode(false);
        const qty = editingItem.quantity_value ?? 1;
        const rawUnit = (editingItem.quantity_unit ?? 'ea').toString().toLowerCase();
        const u = UNITS.includes(rawUnit as (typeof UNITS)[number]) ? rawUnit : 'ea';
        setText(editingItem.name);
        setQuantity(typeof qty === 'number' ? qty : 1);
        setUnit(u);
        setNote(editingItem.notes ?? '');
        setBrandPreference(editingItem.brand_preference ?? '');
        setDetailsExpanded(true);
        setEditZoneKey(editingItem.zone_key);
      } else {
        const d = draftRef.current;
        setText(d.text);
        setQuantity(d.quantity);
        setUnit(d.unit);
        setNote(d.note);
        setBrandPreference(d.brandPreference);
        setDetailsExpanded(!!(d.note?.trim() || d.brandPreference?.trim()));
        /** Default section is Auto (AI); scroll/filter context no longer forces a section. */
        setZoneOverride(null);
      }
    }, [visible, editingItem]);

    const syncParsedFromText = useCallback((raw: string) => {
      const parsed = parseSingleEntry(raw);
      if (parsed.name) {
        setQuantity(parsed.quantity);
        const normUnit = parsed.unit.toLowerCase();
        setUnit(UNITS.includes(normUnit as (typeof UNITS)[number]) ? normUnit : 'ea');
      }
    }, []);

    /**
     * Typing-time pre-warm: when the user pauses typing a plausible single item name
     * in add mode, speculatively categorize it in the background so the submit path
     * can take the local-cache fast path (no AI wait, no "Other" flicker).
     *
     * Guarded to:
     *   - only fire in add mode (not edit, not smart mode)
     *   - skip inputs shorter than 3 chars (avoids wasting rate-limit budget on "ap")
     *   - skip multi-item expressions ("milk, eggs") — multi-item path doesn't optimistic-insert
     *   - debounce 600ms so each keystroke doesn't fire a call
     *   - abort (discard result + ignore stale response) if the user keeps typing
     *   - abort on composer dismiss via prewarmAbortRef in the visibility reset effect
     *
     * categorizeItems transparently short-circuits on local cache hits, so repeat
     * pre-warms of the same word are free. Network calls are rate-limited server-side.
     */
    useEffect(() => {
      if (!visible) return;
      if (smartMode || editingItem) return;
      const trimmed = text.trim();
      if (trimmed.length < 3) return;
      // Avoid pre-warming when the user typed a comma-separated multi-item entry —
      // the multi-item submit path doesn't use the optimistic fast path anyway.
      if (parseItems(text).length > 1) return;

      const parsed = parseSingleEntry(text);
      const name = parsed?.name?.trim();
      if (!name || name.length < 3) return;

      if (prewarmAbortRef.current) {
        prewarmAbortRef.current.cancelled = true;
      }
      const token = { cancelled: false };
      prewarmAbortRef.current = token;

      const timeoutId = setTimeout(() => {
        if (token.cancelled) return;
        void (async () => {
          try {
            await categorizeItems([name], storeType, zoneLabelsInOrder);
          } catch {
            // Background only — if the warm call fails the submit path falls back
            // to its existing optimistic-insert-under-'other' behavior.
          }
        })();
      }, 600);

      return () => {
        clearTimeout(timeoutId);
        token.cancelled = true;
      };
    }, [visible, text, smartMode, editingItem, storeType, zoneLabelsInOrder]);

    const handleTextChange = useCallback(
      (s: string) => {
        setText(s);
        setError(null);
        syncParsedFromText(s);
      },
      [syncParsedFromText]
    );

    const handleFocus = useCallback(() => {
      isFocused.current = true;
    }, []);

    const handleBlur = useCallback(() => {
      isFocused.current = false;
      const formatted = text.trim() === '' ? '' : titleCaseWords(text);
      if (formatted !== text) {
        setText(formatted);
        syncParsedFromText(formatted);
      }
      draftRef.current = {
        text: formatted,
        quantity,
        unit,
        note,
        brandPreference,
      };
    }, [text, quantity, unit, note, brandPreference, syncParsedFromText]);

    const handleDismiss = useCallback(() => {
      draftRef.current = { text, quantity, unit, note, brandPreference };
      onDismiss();
    }, [text, quantity, unit, note, brandPreference, onDismiss]);

    const dismissWithoutSavingDraft = useCallback(() => {
      onDismiss();
    }, [onDismiss]);

    const performSubmit = useCallback(
      async (items: ParsedItem[]) => {
        if (items.length === 0) return;
        setLoading(true);
        setError(null);
        try {
          await onSubmit(items, zoneOverride);
          dismissWithoutSavingDraft();
          haptics.success();
          setText('');
          setQuantity(1);
          setUnit('ea');
          setNote('');
          setBrandPreference('');
          setDetailsExpanded(false);
          draftRef.current = { text: '', quantity: 1, unit: 'ea', note: '', brandPreference: '' };
        } catch (e) {
          if ((e as { code?: string })?.code === 'DUPLICATE') {
            setError(null);
          } else {
            setError(e instanceof Error ? e.message : 'Failed to add items');
          }
        } finally {
          setLoading(false);
        }
      },
      [onSubmit, zoneOverride, haptics, dismissWithoutSavingDraft]
    );

    const performSmartBulkAdd = useCallback(
      async (items: ParsedListItem[]) => {
        if (!onBulkAddPreCategorized || items.length === 0) return;
        setLoading(true);
        setError(null);
        try {
          await onBulkAddPreCategorized(items);
          dismissWithoutSavingDraft();
          haptics.success();
          setText('');
          setQuantity(1);
          setUnit('ea');
          setNote('');
          setBrandPreference('');
          setDetailsExpanded(false);
          setSmartMode(false);
          draftRef.current = { text: '', quantity: 1, unit: 'ea', note: '', brandPreference: '' };
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Failed to add items');
        } finally {
          setLoading(false);
        }
      },
      [onBulkAddPreCategorized, dismissWithoutSavingDraft, haptics]
    );

    const handleSmartParse = useCallback(async () => {
      const trimmed = text.trim();
      if (!trimmed) {
        setError('Describe what you need to add');
        return;
      }
      if (!onBulkAddPreCategorized) {
        setError('Smart add is unavailable right now');
        return;
      }
      setSmartBusy(true);
      setError(null);
      const abort = { cancelled: false };
      smartParseAbortRef.current = abort;
      try {
        const parsed = await parseListItemsFromText(trimmed, storeType, zoneLabelsInOrder);
        if (abort.cancelled) return;
        if (parsed.length === 0) {
          setError(
            "Didn't catch any items — try rephrasing or tap the sparkle to go back to single-item mode."
          );
          return;
        }
        // Directly bulk-insert the pre-categorized rows. Single-item Add has no extra
        // confirmation step either — the user has already tapped "Parse with AI" as an
        // explicit confirmation of intent. Presenting a second Modal alert on top of
        // the composer's Modal is unreliable on iOS (the alert silently fails to
        // present), so we insert straight through `performSmartBulkAdd`.
        await performSmartBulkAdd(parsed);
      } catch (e) {
        if (abort.cancelled) return;
        setError(e instanceof Error ? e.message : 'Smart add failed. Try again.');
      } finally {
        if (!abort.cancelled) setSmartBusy(false);
        if (smartParseAbortRef.current === abort) smartParseAbortRef.current = null;
      }
    }, [text, onBulkAddPreCategorized, storeType, zoneLabelsInOrder, performSmartBulkAdd]);

    const toggleSmartMode = useCallback(() => {
      if (!smartAvailable) return;
      haptics.light();
      setError(null);
      animateLayout();
      setSmartMode((v) => {
        const next = !v;
        if (!next && smartParseAbortRef.current) {
          smartParseAbortRef.current.cancelled = true;
          smartParseAbortRef.current = null;
          setSmartBusy(false);
        }
        return next;
      });
    }, [smartAvailable, haptics, animateLayout]);

    const handleSubmit = useCallback(async () => {
      if (smartMode) {
        await handleSmartParse();
        return;
      }
      const trimmed = text.trim();
      if (!trimmed) {
        setError('Enter at least one item');
        return;
      }

      if (editingItem && onEdit) {
        const primary = titleCaseWords(trimmed);
        if (primary !== text) {
          setText(primary);
          syncParsedFromText(primary);
        }
        const parsed = parseSingleEntry(primary);
        if (!parsed.name || parsed.name === 'item') {
          setError('Enter a valid item');
          return;
        }
        const item: ParsedItem = {
          ...parsed,
          quantity,
          unit,
          brand_preference: brandPreference.trim() ? titleCaseWords(brandPreference.trim()) : null,
          substitute_allowed: editingItem.substitute_allowed ?? true,
          priority: editingItem.priority ?? 'normal',
          is_recurring: editingItem.is_recurring ?? false,
        };
        if (note.trim()) item.note = note.trim();
        setLoading(true);
        setError(null);
        try {
          await onEdit(editingItem.id, item, editZoneKey);
          dismissWithoutSavingDraft();
          haptics.success();
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Failed to update');
        } finally {
          setLoading(false);
        }
        return;
      }

      const raw = parseItems(trimmed);
      if (raw.length === 0) {
        setError('Enter at least one item');
        return;
      }

      if (raw.length > 1) {
        const bulkText = raw.map((line) => titleCaseWords(line)).join('\n');
        if (bulkText !== text) {
          setText(bulkText);
        }
        const items = parseBulkToItems(bulkText);
        if (items.length === 0) {
          setError('Enter at least one item');
          return;
        }
        setAddItemsDialogItems(items);
        setAddItemsDialogVisible(true);
      } else {
        const primary = titleCaseWords(trimmed);
        if (primary !== text) {
          setText(primary);
          syncParsedFromText(primary);
        }
        const parsed = parseSingleEntry(primary);
        if (!parsed.name || parsed.name === 'item') {
          setError('Enter a valid item');
          return;
        }
        const item: ParsedItem = {
          ...parsed,
          quantity,
          unit,
          brand_preference: brandPreference.trim() ? titleCaseWords(brandPreference.trim()) : null,
          substitute_allowed: true,
          priority: 'normal',
          is_recurring: false,
        };
        if (note.trim()) item.note = note.trim();
        await performSubmit([item]);
      }
    }, [
      smartMode,
      handleSmartParse,
      text,
      quantity,
      unit,
      note,
      brandPreference,
      performSubmit,
      editingItem,
      onEdit,
      haptics,
      dismissWithoutSavingDraft,
      editZoneKey,
      syncParsedFromText,
    ]);

    const handleKeyPress = useCallback(
      (e: { nativeEvent: { key: string } }) => {
        if (e.nativeEvent.key === 'Enter') {
          handleSubmit();
        }
      },
      [handleSubmit]
    );

    const incrementQty = useCallback(() => {
      expandDetails();
      haptics.light();
      setQuantity((q) => q + 1);
    }, [haptics, expandDetails]);

    const decrementQty = useCallback(() => {
      expandDetails();
      haptics.light();
      setQuantity((q) => Math.max(1, q - 1));
    }, [haptics, expandDetails]);

    const commitUnitFromSheet = useCallback((u: Unit) => {
      setUnit(u);
    }, []);

    const showSecondaryFields = !!editingItem || detailsExpanded;
    const formCompact = !editingItem && !detailsExpanded;

    const sectionPickerLabel = editingItem
      ? ZONE_LABELS[editZoneKey]
      : zoneOverride === null
        ? 'Auto (suggested)'
        : ZONE_LABELS[zoneOverride];

    const openZonePicker = useCallback(() => {
      Keyboard.dismiss();
      haptics.light();
      setUnitSheetVisible(false);
      setZoneSheetVisible(true);
    }, [haptics]);

    const openUnitPicker = useCallback(() => {
      Keyboard.dismiss();
      haptics.light();
      setZoneSheetVisible(false);
      setUnitSheetVisible(true);
    }, [haptics]);

    const displayUnit = useMemo(() => {
      const n = (unit ?? 'ea').toString().toLowerCase();
      return UNITS.includes(n as (typeof UNITS)[number]) ? n : 'ea';
    }, [unit]);

    /** Scroll cap: in-sheet KAV pads for the keyboard — do not also subtract keyboard height here. */
    const scrollMaxHeight = Math.max(120, windowHeight * 0.9 - 200);
    const footerPaddingBottom = Math.max(insets.bottom, CTA_GUTTER_PX);

    const formFieldsEl = (
              <View style={styles.content}>
                {error ? (
                  <View
                    style={[
                      styles.errorBanner,
                      { backgroundColor: theme.danger + '15', marginBottom: theme.spacing.sm },
                    ]}
                  >
                    <Ionicons
                      name="alert-circle-outline"
                      size={16}
                      color={theme.danger}
                      style={styles.errorIcon}
                    />
                    <Text style={[theme.typography.footnote, { color: theme.danger }]}>{error}</Text>
                  </View>
                ) : null}

                <View style={styles.inputRow}>
                  <TextInput
                    ref={inputRef}
                    testID="quick-add-item-input"
                    value={text}
                    onChangeText={handleTextChange}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    onSubmitEditing={editingItem ? handleSubmit : undefined}
                    onKeyPress={handleKeyPress}
                    placeholder={
                      editingItem
                        ? 'Item name'
                        : smartMode
                          ? 'Describe what you need — e.g. a gallon of milk, two pounds of chicken, some avocados'
                          : 'e.g. Chicken Breasts'
                    }
                    placeholderTextColor={theme.textSecondary}
                    multiline
                    numberOfLines={editingItem ? undefined : smartMode ? 4 : 1}
                    scrollEnabled={!!editingItem || smartMode}
                    blurOnSubmit={!!editingItem}
                    returnKeyType={smartMode ? 'default' : 'done'}
                    style={[
                      theme.typography.body,
                      styles.itemInput,
                      smartMode && styles.itemInputSmart,
                      {
                        color: theme.textPrimary,
                        backgroundColor: theme.surface,
                        borderColor: error ? theme.danger : smartMode ? theme.accent : theme.divider,
                        flex: 1,
                      },
                    ]}
                  />
                  {smartAvailable ? (
                    <TouchableOpacity
                      onPress={toggleSmartMode}
                      disabled={smartBusy}
                      style={[
                        styles.sparkleBtn,
                        {
                          backgroundColor: smartMode ? theme.accent + '20' : theme.surface,
                          borderColor: smartMode ? theme.accent : theme.divider,
                          opacity: smartBusy ? 0.5 : 1,
                        },
                      ]}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel={smartMode ? 'Turn off smart add' : 'Turn on smart add'}
                      accessibilityState={{ selected: smartMode }}
                      testID="quick-add-sparkle-toggle"
                    >
                      <Ionicons
                        name="sparkles"
                        size={18}
                        color={smartMode ? theme.accent : theme.textSecondary}
                      />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {smartMode && !editingItem ? (
                  <Text
                    style={[
                      theme.typography.footnote,
                      {
                        color: theme.textSecondary,
                        marginTop: theme.spacing.sm,
                        lineHeight: 18,
                      },
                    ]}
                  >
                    {AI_SMART_CATEGORIZATION_DISCLOSURE_LEAD}
                  </Text>
                ) : null}

                {!editingItem && !smartMode && recentSuggestions.length > 0 ? (
                  <RNScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={styles.suggestionsChips}
                    style={styles.suggestionsRow}
                    nestedScrollEnabled={Platform.OS === 'android'}
                  >
                    {recentSuggestions.map((item) => (
                      <TouchableOpacity
                        key={item.normalized_name}
                        activeOpacity={0.7}
                        onPress={() => {
                          haptics.light();
                          const name = item.display_name;
                          setText(name);
                          setUnit(item.last_unit ?? 'ea');
                          syncParsedFromText(name);
                        }}
                        style={[
                          styles.suggestionChip,
                          { backgroundColor: theme.surface, borderColor: theme.divider },
                        ]}
                      >
                        <Text style={[theme.typography.footnote, { color: theme.textPrimary }]} numberOfLines={1}>
                          {item.display_name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </RNScrollView>
                ) : null}

                {smartMode ? null : (
                <View style={styles.qtyRow}>
                  <Text style={[theme.typography.footnote, styles.qtyLabel, { color: theme.textSecondary }]}>
                    Qty
                  </Text>
                  <View style={[styles.stepper, { backgroundColor: theme.background, borderColor: theme.divider }]}>
                    <TouchableOpacity
                      onPress={decrementQty}
                      style={styles.stepperBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel="Decrease quantity"
                    >
                      <Ionicons name="remove" size={18} color={theme.textPrimary} />
                    </TouchableOpacity>
                    <Text style={[theme.typography.body, styles.stepperValue, { color: theme.textPrimary }]}>
                      {quantity}
                    </Text>
                    <TouchableOpacity
                      onPress={incrementQty}
                      style={styles.stepperBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel="Increase quantity"
                    >
                      <Ionicons name="add" size={18} color={theme.textPrimary} />
                    </TouchableOpacity>
                  </View>
                  <Pressable
                    onPress={openUnitPicker}
                    style={({ pressed }) => [
                      styles.unitDropdown,
                      {
                        backgroundColor: theme.background,
                        borderColor: theme.divider,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Change unit"
                  >
                    <Text style={[theme.typography.body, { color: theme.textPrimary }]}>{displayUnit}</Text>
                    <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
                  </Pressable>
                </View>
                )}

                {!editingItem && !smartMode ? (
                  <TouchableOpacity
                    onPress={toggleDetails}
                    style={styles.addDetailsBtn}
                    hitSlop={{ top: 8, bottom: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={detailsExpanded ? 'Hide optional details' : 'Add optional details'}
                  >
                    <Text style={[theme.typography.footnote, { color: theme.accent }]}>
                      {detailsExpanded ? 'Hide details' : 'Add details'}
                    </Text>
                    <Ionicons
                      name={detailsExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={theme.accent}
                    />
                  </TouchableOpacity>
                ) : null}

                {showSecondaryFields && !smartMode ? (
                  <View style={styles.secondaryBlock}>
                    <TextField
                      value={brandPreference}
                      onChangeText={setBrandPreference}
                      placeholder="Brand (optional)"
                      containerStyle={styles.secondaryFieldBrand}
                      formatOnBlur="titleWords"
                      {...(Platform.OS === 'ios'
                        ? { multiline: true, scrollEnabled: false, blurOnSubmit: false }
                        : {})}
                    />
                    <TextField
                      value={note}
                      onChangeText={setNote}
                      placeholder="Note (optional)"
                      multiline
                      numberOfLines={2}
                      containerStyle={styles.secondaryFieldNote}
                    />
                  </View>
                ) : null}
              </View>
    );

    /** Pinned below the scroll area — not inside ScrollView content, so flexGrow on scroll cannot add a band above the keyboard. */
    const footerCtaEl = (
      <View
        style={[
          styles.footerCta,
          {
            backgroundColor: theme.surface,
            paddingTop: CTA_GUTTER_PX,
            paddingBottom: footerPaddingBottom,
          },
        ]}
      >
        <PrimaryButton
          title={editingItem ? 'Save' : smartMode ? 'Parse with AI' : 'Add item'}
          size="compact"
          onPress={() => {
            if (!loading && !smartBusy) haptics.light();
            handleSubmit();
          }}
          disabled={loading || smartBusy}
          loading={loading || smartBusy}
        />
      </View>
    );

    return (
      <>
        <BottomSheet
          visible={visible}
          onClose={handleDismiss}
          onDismissed={onSheetDismissed}
          onEnterAnimationStart={() => inputRef.current?.focus()}
          onExitAnimationStart={() => {
            inputRef.current?.blur();
            Keyboard.dismiss();
          }}
          size="form"
          compactHeader
          expandContent={false}
          formHugContent
          formCompact={formCompact}
          surfaceVariant="solid"
          presentationVariant="form"
          padContent={false}
          testID="quick-add-composer-sheet"
        >
            <View style={[styles.keyboardAvoidingSheet, styles.sheetLayout]}>
              <View style={[styles.sheetHeader, { backgroundColor: theme.surface, zIndex: 2 }]}>
                <View style={styles.headerTopRow}>
                  <Text style={[theme.typography.title3, { color: theme.textPrimary }]}>
                    {editingItem ? 'Edit item' : 'Add item'}
                  </Text>
                  <Pressable
                    onPress={handleDismiss}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={[theme.typography.body, { color: theme.accent }]}>Cancel</Text>
                  </Pressable>
                </View>
                {smartMode ? null : (
                  <Pressable
                    style={({ pressed }) => [styles.zoneRow, pressed && { opacity: 0.75 }]}
                    onPress={openZonePicker}
                    accessibilityRole="button"
                    accessibilityLabel="Change store section"
                  >
                    <View style={styles.zoneRowLabels}>
                      <Text style={[theme.typography.footnote, { color: theme.textSecondary }]}>Section</Text>
                      <Text
                        style={[theme.typography.body, { color: theme.textPrimary, marginTop: theme.spacing.xs }]}
                        numberOfLines={1}
                      >
                        {sectionPickerLabel}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                  </Pressable>
                )}
                <View style={[styles.headerDivider, { backgroundColor: theme.divider }]} />
              </View>

              <ScrollView
                style={[styles.scrollContent, { maxHeight: scrollMaxHeight }]}
                contentContainerStyle={styles.scrollContentContainer}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                automaticallyAdjustKeyboardInsets={false}
                {...(Platform.OS === 'ios' && {
                  contentInsetAdjustmentBehavior: 'never' as const,
                })}
              >
                {formFieldsEl}
              </ScrollView>
              {footerCtaEl}
              {zoneSheetVisible ? (
                <View style={styles.zoneOverlayRoot} pointerEvents="box-none">
                  <Pressable
                    style={[StyleSheet.absoluteFill, styles.zoneOverlayBackdrop]}
                    onPress={() => setZoneSheetVisible(false)}
                  />
                  <View
                    style={[
                      styles.zoneOverlayPanel,
                      theme.shadows.floating,
                      {
                        backgroundColor: theme.surface,
                        paddingBottom: Math.max(insets.bottom, theme.spacing.md),
                      },
                    ]}
                  >
                    <ListItemZonePickerPanel
                      layout="embedded"
                      allowAuto={!editingItem}
                      value={editingItem ? editZoneKey : zoneOverride}
                      zoneOrder={zoneOrderForPicker}
                      onCommit={(z) => {
                        if (editingItem) {
                          if (z != null) setEditZoneKey(z);
                        } else {
                          setZoneOverride(z);
                        }
                        setZoneSheetVisible(false);
                        haptics.light();
                      }}
                    />
                  </View>
                </View>
              ) : unitSheetVisible ? (
                <View style={styles.zoneOverlayRoot} pointerEvents="box-none">
                  <Pressable
                    style={[StyleSheet.absoluteFill, styles.zoneOverlayBackdrop]}
                    onPress={() => setUnitSheetVisible(false)}
                  />
                  <View
                    style={[
                      styles.zoneOverlayPanel,
                      theme.shadows.floating,
                      {
                        backgroundColor: theme.surface,
                        paddingBottom: Math.max(insets.bottom, theme.spacing.md),
                      },
                    ]}
                  >
                    <View style={{ gap: theme.spacing.md }}>
                      <Text style={[theme.typography.headline, { color: theme.textPrimary }]}>Unit</Text>
                      <UnitSelectionList
                        value={displayUnit}
                        onSelect={(selectedUnit) => {
                          haptics.light();
                          commitUnitFromSheet(selectedUnit);
                          setUnitSheetVisible(false);
                        }}
                      />
                    </View>
                  </View>
                </View>
              ) : null}
            </View>
        </BottomSheet>
        <AppConfirmationDialog
          visible={addItemsDialogVisible}
          onClose={() => {
            setAddItemsDialogVisible(false);
            setAddItemsDialogItems(null);
          }}
          title="Add items"
          message={addItemsDialogItems ? `Add ${addItemsDialogItems.length} items to your list?` : undefined}
          buttons={[
            { label: 'Cancel', onPress: () => {}, cancel: true },
            {
              label: 'Add',
              onPress: () => {
                if (addItemsDialogItems) performSubmit(addItemsDialogItems);
              },
            },
          ]}
        />
      </>
    );
  }
);
