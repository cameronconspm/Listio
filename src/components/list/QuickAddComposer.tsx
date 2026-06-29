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
} from 'react-native';
import { ScrollView, Pressable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet } from '../ui/BottomSheet';
import { cardShellStyle } from '../ui/Card';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/ThemeContext';
import { AnimatedQuantityValue } from '../ui/AnimatedQuantityValue';
import { PressableScale } from '../ui/PressableScale';
import { PrimaryButton } from '../ui/PrimaryButton';
import { AppConfirmationDialog } from '../ui/AppConfirmationDialog';
import { useHaptics } from '../../hooks/useHaptics';
import {
  parseItems,
  parseSingleEntry,
  parseBulkToItems,
  type ParsedItem,
} from '../../utils/parseItems';
import { titleCaseWords } from '../../utils/titleCaseWords';
import { UNITS, type Unit } from '../../data/units';
import { useItemNameSuggestions } from '../../hooks/useItemNameSuggestions';
import { loadRecentItemsForSuggestions, type RecentItem } from '../../services/recentItemsStore';
import type { ListItem, ZoneKey } from '../../types/models';
import { ZONE_LABELS } from '../../data/zone';
import { ListItemZonePickerPanel } from './ListItemZoneSheet';
import { createQuickAddComposerStyles } from './quickAddComposerStyles';
import { UnitSelectionList } from '../ui/UnitSelectionList';
import { duration } from '../../ui/motion/tokens';
import { parseListItemsFromText, categorizeItems } from '../../services/aiService';
import { resolveCategoryFast } from '../../services/aiCategoryCache';
import type { ParsedListItem } from '../../types/api';
import { AI_SMART_CATEGORIZATION_DISCLOSURE_LEAD } from '../../constants/aiPrivacyDisclosure';
import { ensureAiFeatureAccess, commitAiTaste } from '../../services/aiFeatureTaste';
import { usePremiumEntitlement } from '../../context/PremiumEntitlementContext';
import { DuplicateResolutionPanel } from './DuplicateResolutionPanel';
import type { DuplicateMatch } from '../../utils/duplicateDetection';

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
  /** When adding a single item, detect duplicates before submit. */
  onCheckDuplicate?: (item: ParsedItem) => DuplicateMatch | null;
  onDuplicateMerge?: (match: DuplicateMatch, incoming: ParsedItem) => Promise<void>;
  onDuplicateAddSeparately?: (incoming: ParsedItem) => Promise<void>;
};

type ComposerDropdown = 'section' | 'unit' | null;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export const QuickAddComposer = forwardRef(function QuickAddComposer(
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
    onCheckDuplicate,
    onDuplicateMerge,
    onDuplicateAddSeparately,
  }: QuickAddComposerProps,
  ref: React.ForwardedRef<QuickAddComposerHandle>
) {
  const theme = useTheme();
  const styles = useMemo(() => createQuickAddComposerStyles(theme), [theme]);
  const CTA_GUTTER_PX = theme.spacing.xs;
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const haptics = useHaptics();
  const { isPremium, isPremiumLoading } = usePremiumEntitlement();
  const categorizeOpts = useMemo(
    () => ({ premiumHint: { isPremium, isLoading: isPremiumLoading } }),
    [isPremium, isPremiumLoading]
  );
  const inputRef = useRef<TextInput>(null);
  /** Uncontrolled name field — avoids iOS dictation fighting a controlled `value`. */
  const [nameInputSeed, setNameInputSeed] = useState({ key: 0, initial: '' });

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
  /** Drives the accent focus border on the name input — visual confirmation of which field is active. */
  const [nameFocused, setNameFocused] = useState(false);
  /** Add flow: null = Auto (AI section). */
  const [zoneOverride, setZoneOverride] = useState<ZoneKey | null>(null);
  const [editZoneKey, setEditZoneKey] = useState<ZoneKey>('other');
  const [openDropdown, setOpenDropdown] = useState<ComposerDropdown>(null);
  /**
   * Smart Add: AI-parses natural language ("a gallon of milk, two pounds of chicken")
   * into structured rows. Only available when `onBulkAddPreCategorized` is wired and we
   * aren't editing an existing item. Toggled by the sparkle icon next to the text field.
   */
  const [smartMode, setSmartMode] = useState(false);
  const [smartBusy, setSmartBusy] = useState(false);
  const [duplicatePrompt, setDuplicatePrompt] = useState<{
    match: DuplicateMatch;
    incoming: ParsedItem;
  } | null>(null);
  const smartParseAbortRef = useRef<{ cancelled: boolean } | null>(null);
  const smartAvailable = !editingItem && !!onBulkAddPreCategorized;

  /**
   * Pre-warm token for the typing-time categorize call. Flipping `cancelled = true`
   * discards the result if the user kept typing or dismissed before OpenAI returned.
   */
  const prewarmAbortRef = useRef<{ cancelled: boolean } | null>(null);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    if (!visible || editingItem) {
      setRecentItems([]);
      return;
    }
    void loadRecentItemsForSuggestions().then(setRecentItems);
  }, [visible, editingItem]);

  const { suggestions: recentSuggestions } = useItemNameSuggestions({
    query: text,
    enabled: visible && !editingItem && !smartMode,
    recentItems,
    includeTypedFallback: false,
  });

  const draftRef = useRef({
    text: '',
    quantity: 1,
    unit: 'ea',
    note: '',
    brandPreference: '',
  });

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
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
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
      setOpenDropdown(null);
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

    let initialName = '';
    if (editingItem) {
      setSmartMode(false);
      const qty = editingItem.quantity_value ?? 1;
      const rawUnit = (editingItem.quantity_unit ?? 'ea').toString().toLowerCase();
      const u = UNITS.includes(rawUnit as (typeof UNITS)[number]) ? rawUnit : 'ea';
      initialName = editingItem.name;
      setText(initialName);
      setQuantity(typeof qty === 'number' ? qty : 1);
      setUnit(u);
      setNote(editingItem.notes ?? '');
      setBrandPreference(editingItem.brand_preference ?? '');
      setDetailsExpanded(true);
      setEditZoneKey(editingItem.zone_key);
    } else {
      const d = draftRef.current;
      initialName = d.text;
      setText(initialName);
      setQuantity(d.quantity);
      setUnit(d.unit);
      setNote(d.note);
      setBrandPreference(d.brandPreference);
      setDetailsExpanded(!!(d.note?.trim() || d.brandPreference?.trim()));
      /** Default section is Auto (AI); scroll/filter context no longer forces a section. */
      setZoneOverride(null);
    }
    setNameInputSeed((seed) => ({ key: seed.key + 1, initial: initialName }));
    setOpenDropdown(null);
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
   * can take the local-cache fast path (no AI wait before the correctly placed insert).
   *
   * Guarded to:
   *   - only fire in add mode (not edit, not smart mode)
   *   - skip inputs shorter than 3 chars (avoids wasting rate-limit budget on "ap")
   *   - skip multi-item expressions ("milk, eggs") — multi-item path categorizes in one batch
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
    // the multi-item submit path categorizes the whole batch together.
    if (parseItems(text).length > 1) return;

    const parsed = parseSingleEntry(text);
    const name = parsed?.name?.trim();
    if (!name || name.length < 3) return;
    if (resolveCategoryFast(name)) return;

    if (prewarmAbortRef.current) {
      prewarmAbortRef.current.cancelled = true;
    }
    const token = { cancelled: false };
    prewarmAbortRef.current = token;

    const timeoutId = setTimeout(() => {
      if (token.cancelled) return;
      void (async () => {
        try {
          await categorizeItems([name], storeType, zoneLabelsInOrder, categorizeOpts);
        } catch {
          // Background only — submit can still categorize before inserting.
        }
      })();
    }, 600);

    return () => {
      clearTimeout(timeoutId);
      token.cancelled = true;
    };
  }, [visible, text, smartMode, editingItem, storeType, zoneLabelsInOrder, categorizeOpts]);

  const handleTextChange = useCallback(
    (s: string) => {
      setText(s);
      setError(null);
      syncParsedFromText(s);
    },
    [syncParsedFromText]
  );

  const handleBlur = useCallback(() => {
    const formatted = text.trim() === '' ? '' : titleCaseWords(text);
    if (formatted !== text) {
      setText(formatted);
      inputRef.current?.setNativeProps({ text: formatted });
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
    setDuplicatePrompt(null);
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
    const gate = await ensureAiFeatureAccess('smart_add', 'smart_add', isPremium, isPremiumLoading);
    if (!gate.allowed) return;
    setSmartBusy(true);
    setError(null);
    const abort = { cancelled: false };
    smartParseAbortRef.current = abort;
    try {
      const parsed = await parseListItemsFromText(trimmed, storeType, zoneLabelsInOrder, {
        premiumHint: { isPremium, isLoading: isPremiumLoading },
      });
      if (abort.cancelled) return;
      if (parsed.length === 0) {
        setError(
          "Didn't catch any items. Try rephrasing or tap the sparkle to go back to single-item mode."
        );
        return;
      }
      if (gate.usesFreeAllowance) await commitAiTaste('smart_add');
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
  }, [
    text,
    onBulkAddPreCategorized,
    storeType,
    zoneLabelsInOrder,
    performSmartBulkAdd,
    isPremium,
    isPremiumLoading,
  ]);

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
      if (onCheckDuplicate) {
        const match = onCheckDuplicate(item);
        if (match) {
          haptics.light();
          setDuplicatePrompt({ match, incoming: item });
          return;
        }
      }
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
    onCheckDuplicate,
  ]);

  const handleDuplicateCancel = useCallback(() => {
    setDuplicatePrompt(null);
  }, []);

  const handleDuplicateMergePress = useCallback(async () => {
    if (!duplicatePrompt || !onDuplicateMerge) return;
    setLoading(true);
    setError(null);
    try {
      await onDuplicateMerge(duplicatePrompt.match, duplicatePrompt.incoming);
      setDuplicatePrompt(null);
      dismissWithoutSavingDraft();
      haptics.success();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not merge items');
    } finally {
      setLoading(false);
    }
  }, [duplicatePrompt, onDuplicateMerge, dismissWithoutSavingDraft, haptics]);

  const handleDuplicateAddSeparatelyPress = useCallback(async () => {
    if (!duplicatePrompt || !onDuplicateAddSeparately) return;
    setLoading(true);
    setError(null);
    try {
      await onDuplicateAddSeparately(duplicatePrompt.incoming);
      setDuplicatePrompt(null);
      dismissWithoutSavingDraft();
      haptics.success();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add item');
    } finally {
      setLoading(false);
    }
  }, [duplicatePrompt, onDuplicateAddSeparately, dismissWithoutSavingDraft, haptics]);

  const handleKeyPress = useCallback(
    (e: { nativeEvent: { key: string } }) => {
      if (editingItem && e.nativeEvent.key === 'Enter') {
        handleSubmit();
      }
    },
    [editingItem, handleSubmit]
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

  /** Sheet height hint: collapsed (add, no details) is short; otherwise full form. */
  const formCompact = !editingItem && !detailsExpanded;

  const sectionPickerLabel = editingItem
    ? ZONE_LABELS[editZoneKey]
    : zoneOverride === null
      ? 'Auto (suggested)'
      : ZONE_LABELS[zoneOverride];

  const openZonePicker = useCallback(() => {
    const next = openDropdown === 'section' ? null : 'section';
    haptics.light();
    setOpenDropdown(next);
  }, [haptics, openDropdown]);

  const openUnitPicker = useCallback(() => {
    const next = openDropdown === 'unit' ? null : 'unit';
    haptics.light();
    setOpenDropdown(next);
  }, [haptics, openDropdown]);

  const displayUnit = useMemo(() => {
    const n = (unit ?? 'ea').toString().toLowerCase();
    return UNITS.includes(n as (typeof UNITS)[number]) ? n : 'ea';
  }, [unit]);

  const footerPaddingBottom = Math.max(insets.bottom, CTA_GUTTER_PX);
  /** Scroll cap when the keyboard is up — leave room for handle, footer, and safe area. */
  const scrollMaxHeight = Math.max(
    120,
    windowHeight * 0.9 - footerPaddingBottom - 160
  );

  const showNoteField = !smartMode && (!!editingItem || detailsExpanded);
  const showBrandRow = !smartMode && (!!editingItem || detailsExpanded);
  const showMetaCard = !smartMode;

  const renderMetaRow = (
    key: string,
    label: string,
    rightSlot: React.ReactNode,
    onPress?: () => void,
    isExpanded?: boolean
  ) => {
    const inner = (
      <View style={styles.metaRow}>
        <Text style={[theme.typography.body, styles.metaLabel, { color: theme.textPrimary }]}>
          {label}
        </Text>
        {rightSlot}
      </View>
    );
    if (onPress) {
      return (
        <PressableScale
          key={key}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={isExpanded != null ? { expanded: isExpanded } : undefined}
        >
          {inner}
        </PressableScale>
      );
    }
    return <View key={key}>{inner}</View>;
  };

  const formFieldsEl = (
    <View style={styles.content}>
      {error ? (
        <View
          style={[
            styles.errorBanner,
            { backgroundColor: theme.danger + '15' },
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

      {/* ── Item name (TextField-aligned) ──────────────────────────────── */}
      {!smartMode && !editingItem ? (
        <Text
          style={[
            theme.typography.footnote,
            styles.fieldLabel,
            { color: theme.textSecondary },
          ]}
        >
          Item name
        </Text>
      ) : null}
      <View style={styles.nameFieldRow}>
        <View
          style={[
            smartMode ? null : styles.nameFieldShell,
            !smartMode && {
              backgroundColor: theme.surface,
              borderColor: error
                ? theme.danger
                : nameFocused
                  ? theme.accent
                  : theme.divider,
            },
            smartMode && { flex: 1 },
          ]}
        >
          <TextInput
            key={nameInputSeed.key}
            ref={inputRef}
            testID="quick-add-item-input"
            defaultValue={nameInputSeed.initial}
            onChangeText={handleTextChange}
            onFocus={() => setNameFocused(true)}
            onBlur={() => {
              setNameFocused(false);
              handleBlur();
            }}
            onSubmitEditing={editingItem ? handleSubmit : undefined}
            onKeyPress={handleKeyPress}
            placeholder={
              editingItem
                ? 'Item name'
                : smartMode
                  ? 'Describe what you need, e.g. a gallon of milk, two pounds of chicken, some avocados'
                  : 'Item name'
            }
            placeholderTextColor={theme.textSecondary}
            keyboardAppearance={theme.colorScheme}
            multiline={smartMode}
            numberOfLines={smartMode ? 4 : 1}
            scrollEnabled={smartMode}
            blurOnSubmit={!!editingItem}
            returnKeyType={smartMode ? 'default' : 'done'}
            textAlign="left"
            {...(!smartMode && { textAlignVertical: 'center' as const })}
            style={[
              theme.typography.body,
              smartMode ? styles.smartInput : styles.nameInput,
              smartMode && {
                backgroundColor: theme.surface,
                borderColor: error ? theme.danger : theme.divider,
              },
              { color: theme.textPrimary },
            ]}
          />
        </View>
        {smartAvailable && !smartMode ? (
          <PressableScale
            onPress={toggleSmartMode}
            disabled={smartBusy}
            style={[
              styles.heroSmartBtn,
              {
                backgroundColor: theme.surface,
                borderColor: theme.divider,
                opacity: smartBusy ? 0.5 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Turn on smart add"
            accessibilityState={{ selected: false }}
            testID="quick-add-sparkle-toggle"
          >
            <Ionicons name="sparkles" size={16} color={theme.textSecondary} />
          </PressableScale>
        ) : null}
        {smartMode ? (
          <PressableScale
            onPress={toggleSmartMode}
            disabled={smartBusy}
            style={[
              styles.heroSmartBtn,
              {
                backgroundColor: theme.accent + '20',
                borderColor: theme.accent,
                opacity: smartBusy ? 0.5 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Turn off smart add"
            accessibilityState={{ selected: true }}
            testID="quick-add-sparkle-toggle"
          >
            <Ionicons name="sparkles" size={16} color={theme.accent} />
          </PressableScale>
        ) : null}
      </View>

      {/* ── Note ───────────────────────────────────────────────────────── */}
      {showNoteField ? (
        <>
          {!editingItem ? (
            <Text
              style={[
                theme.typography.footnote,
                styles.fieldLabel,
                { color: theme.textSecondary, marginTop: theme.spacing.sm },
              ]}
            >
              Note
            </Text>
          ) : null}
          <View
            style={[
              styles.noteFieldShell,
              {
                backgroundColor: theme.surface,
                borderColor: theme.divider,
                marginTop: editingItem ? theme.spacing.sm : 0,
              },
            ]}
          >
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Add a note"
              placeholderTextColor={theme.textSecondary}
              keyboardAppearance={theme.colorScheme}
              textAlign="left"
              textAlignVertical="center"
              returnKeyType="done"
              style={[theme.typography.body, styles.noteInput, { color: theme.textPrimary }]}
            />
          </View>
        </>
      ) : null}

      {/* ── Smart-mode disclosure ──────────────────────────────────────── */}
      {smartMode && !editingItem ? (
        <Text
          style={[
            theme.typography.footnote,
            styles.smartDisclosure,
            { color: theme.textSecondary },
          ]}
        >
          {AI_SMART_CATEGORIZATION_DISCLOSURE_LEAD}
        </Text>
      ) : null}

      {/* ── Recent suggestions (add mode only) ─────────────────────────── */}
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
              <Text
                style={[theme.typography.footnote, { color: theme.textPrimary }]}
                numberOfLines={1}
              >
                {item.display_name}
              </Text>
            </TouchableOpacity>
          ))}
        </RNScrollView>
      ) : null}

      {/* ── Grouped meta card ──────────────────────────────────────────── */}
      {showMetaCard ? (
        <>
          {!editingItem ? (
            <Text
              style={[
                theme.typography.caption1,
                styles.metaSectionTitle,
                { color: theme.textSecondary },
              ]}
            >
              Details
            </Text>
          ) : null}
          <View
            style={[
              styles.metaCard,
              cardShellStyle(theme, 'raised'),
              editingItem && { marginTop: theme.spacing.sm },
            ]}
          >
          {/* Section */}
          {renderMetaRow(
            'section',
            'Section',
            <>
              <Text
                style={[
                  theme.typography.body,
                  styles.metaValueText,
                  { color: openDropdown === 'section' ? theme.accent : theme.textSecondary },
                ]}
                numberOfLines={1}
              >
                {sectionPickerLabel}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={openDropdown === 'section' ? theme.accent : theme.textSecondary}
                style={styles.metaChevron}
              />
            </>,
            openZonePicker,
            openDropdown === 'section'
          )}

          <View style={[styles.metaDivider, { backgroundColor: theme.divider }]} />

          {/* Quantity (inline stepper, no nav) */}
          {renderMetaRow(
            'quantity',
            'Quantity',
            <View
              style={[
                styles.inlineStepper,
                { backgroundColor: theme.surface, borderColor: theme.divider },
              ]}
            >
              <PressableScale
                onPress={decrementQty}
                style={styles.inlineStepperBtn}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                accessibilityRole="button"
                accessibilityLabel="Decrease quantity"
              >
                <Ionicons name="remove" size={16} color={theme.textPrimary} />
              </PressableScale>
              <AnimatedQuantityValue
                value={quantity}
                style={[
                  theme.typography.body,
                  styles.inlineStepperValue,
                  { color: theme.textPrimary },
                ]}
              />
              <PressableScale
                onPress={incrementQty}
                style={styles.inlineStepperBtn}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                accessibilityRole="button"
                accessibilityLabel="Increase quantity"
              >
                <Ionicons name="add" size={16} color={theme.textPrimary} />
              </PressableScale>
            </View>
          )}

          <View style={[styles.metaDivider, { backgroundColor: theme.divider }]} />

          {/* Unit */}
          {renderMetaRow(
            'unit',
            'Unit',
            <>
              <Text
                style={[
                  theme.typography.body,
                  styles.metaValueText,
                  { color: openDropdown === 'unit' ? theme.accent : theme.textSecondary },
                ]}
              >
                {displayUnit}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={openDropdown === 'unit' ? theme.accent : theme.textSecondary}
                style={styles.metaChevron}
              />
            </>,
            openUnitPicker,
            openDropdown === 'unit'
          )}

          {/* Brand (edit mode or expanded add mode) */}
          {showBrandRow ? (
            <>
              <View style={[styles.metaDivider, { backgroundColor: theme.divider }]} />
              {renderMetaRow(
                'brand',
                'Brand',
                <TextInput
                  value={brandPreference}
                  onChangeText={setBrandPreference}
                  onBlur={() => {
                    const trimmed = brandPreference.trim();
                    if (trimmed !== brandPreference) setBrandPreference(trimmed);
                  }}
                  placeholder="Any"
                  placeholderTextColor={theme.textSecondary}
                  keyboardAppearance={theme.colorScheme}
                  returnKeyType="done"
                  style={[
                    theme.typography.body,
                    styles.brandInlineInput,
                    { color: theme.textPrimary },
                  ]}
                />
              )}
            </>
          ) : null}
          </View>
        </>
      ) : null}

      {/* Reveal note + brand for add mode */}
      {!editingItem && !smartMode && !detailsExpanded ? (
        <TouchableOpacity
          onPress={toggleDetails}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.xs,
            marginTop: theme.spacing.md,
            paddingVertical: theme.spacing.xs,
            alignSelf: 'center',
          }}
          hitSlop={{ top: 8, bottom: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Add note and brand"
        >
          <Ionicons name="add-circle-outline" size={16} color={theme.accent} />
          <Text style={[theme.typography.footnote, { color: theme.accent }]}>
            Add note & brand
          </Text>
        </TouchableOpacity>
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
        theme.shadows.chrome,
      ]}
    >
      <PrimaryButton
        title={editingItem ? 'Save' : smartMode ? 'Add with Smart add' : 'Add item'}
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

  const headerEl = (
    <View style={[styles.sheetHeader, { backgroundColor: theme.surface }]}>
      <View style={styles.headerTopRow}>
        <Text
          style={[
            theme.typography.headline,
            styles.headerTitle,
            { color: theme.textPrimary },
          ]}
        >
          {editingItem ? 'Edit item' : 'Add item'}
        </Text>
        <Pressable
          onPress={handleDismiss}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[theme.typography.subhead, { color: theme.accent, fontWeight: '600' }]}>
            Cancel
          </Text>
        </Pressable>
      </View>
    </View>
  );

  const composerBodyEl = duplicatePrompt ? (
    <DuplicateResolutionPanel
      match={duplicatePrompt.match}
      incoming={duplicatePrompt.incoming}
      onMerge={() => void handleDuplicateMergePress()}
      onAddSeparately={() => void handleDuplicateAddSeparatelyPress()}
      onCancel={handleDuplicateCancel}
    />
  ) : (
    <>
      <ScrollView
        style={[styles.scrollContent, { maxHeight: scrollMaxHeight }]}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets={false}
        stickyHeaderIndices={[0]}
        {...(Platform.OS === 'ios' && {
          contentInsetAdjustmentBehavior: 'never' as const,
        })}
      >
        {headerEl}
        {formFieldsEl}
      </ScrollView>
      {footerCtaEl}
    </>
  );

  const selectorMenuEl = openDropdown ? (
    <View style={styles.selectorOverlayRoot} pointerEvents="box-none">
      <Pressable
        style={styles.selectorBackdrop}
        onPress={() => setOpenDropdown(null)}
        accessibilityRole="button"
        accessibilityLabel="Dismiss selector"
      />
      <View
        style={[
          styles.selectorMenu,
          theme.shadows.floating,
          { backgroundColor: theme.surface, borderColor: theme.divider },
          openDropdown === 'unit' && styles.selectorMenuCompact,
        ]}
      >
        {openDropdown === 'section' ? (
          <ListItemZonePickerPanel
            layout="plain"
            allowAuto={!editingItem}
            value={editingItem ? editZoneKey : zoneOverride}
            zoneOrder={zoneOrderForPicker}
            onCommit={(z) => {
              if (editingItem) {
                if (z != null) setEditZoneKey(z);
              } else {
                setZoneOverride(z);
              }
              haptics.light();
              setOpenDropdown(null);
            }}
          />
        ) : (
          <UnitSelectionList
            value={displayUnit}
            showsVerticalScrollIndicator
            maxHeight={220}
            onSelect={(selectedUnit) => {
              haptics.light();
              commitUnitFromSheet(selectedUnit);
              setOpenDropdown(null);
            }}
          />
        )}
      </View>
    </View>
  ) : null;

  return (
    <>
      <BottomSheet
        visible={visible}
        onClose={handleDismiss}
        onDismissed={onSheetDismissed}
        onEnterAnimationStart={() => {
          /**
           * Focus in lockstep with the slide-in (not after `onPresented`) so the keyboard rises in
           * parallel with the sheet. The reanimated keyboard lift in `useModalSheet` is now active
           * from the first frame, so both animations resolve to the final keyboard-anchored
           * position as a single fluid motion — matching the bottom add bar's behavior instead of
           * the previous two-step "sheet settles, then keyboard snaps it upward" sequence.
           */
          inputRef.current?.focus();
        }}
        onExitAnimationStart={() => {
          inputRef.current?.blur();
          Keyboard.dismiss();
        }}
        size="form"
        compactHeader
        expandContent={false}
        formHugContent
        formCompact={formCompact}
        keyboardLift="reanimated"
        surfaceVariant="solid"
        presentationVariant="form"
        padContent={false}
        testID="quick-add-composer-sheet"
      >
        <View style={[styles.keyboardAvoidingSheet, styles.sheetLayout]}>
          <View style={styles.panelBody}>{composerBodyEl}</View>
          {selectorMenuEl}
        </View>
      </BottomSheet>
      <AppConfirmationDialog
        visible={addItemsDialogVisible}
        onClose={() => {
          setAddItemsDialogVisible(false);
          setAddItemsDialogItems(null);
        }}
        title="Add items"
        message={
          addItemsDialogItems ? `Add ${addItemsDialogItems.length} items to your list?` : undefined
        }
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
});
