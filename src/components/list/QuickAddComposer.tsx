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
import { UNITS, UNITS_ALPHABETICAL, type Unit } from '../../data/units';
import { TextField } from '../ui/TextField';
import { SelectorRow } from '../ui/SelectorRow';
import { useRecentSuggestions } from '../../hooks/useRecentSuggestions';
import type { ListItem, ZoneKey } from '../../types/models';
import { ZONE_LABELS } from '../../data/zone';
import { ListItemZonePickerPanel } from './ListItemZoneSheet';
import { createQuickAddComposerStyles } from './quickAddComposerStyles';

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
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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
        return;
      }

      if (editingItem) {
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

    const handleSubmit = useCallback(async () => {
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

                <TextInput
                  ref={inputRef}
                  value={text}
                  onChangeText={handleTextChange}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  onSubmitEditing={editingItem ? handleSubmit : undefined}
                  onKeyPress={handleKeyPress}
                  placeholder={editingItem ? 'Item name' : 'e.g. milk, 2 apples, chicken'}
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  numberOfLines={editingItem ? undefined : 1}
                  scrollEnabled={!!editingItem}
                  blurOnSubmit={!!editingItem}
                  returnKeyType="done"
                  style={[
                    theme.typography.headline,
                    styles.itemInput,
                    {
                      color: theme.textPrimary,
                      backgroundColor: theme.surface,
                      borderColor: error ? theme.danger : theme.divider,
                    },
                  ]}
                />

                {!editingItem && recentSuggestions.length > 0 ? (
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

                <View style={styles.qtyRow}>
                  <Text style={[theme.typography.footnote, styles.qtyLabel, { color: theme.textSecondary }]}>
                    Qty
                  </Text>
                  <View style={[styles.stepper, { backgroundColor: theme.background, borderColor: theme.divider }]}>
                    <TouchableOpacity
                      onPress={decrementQty}
                      style={[styles.stepperBtn, { borderRightWidth: 1, borderRightColor: theme.divider }]}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel="Decrease quantity"
                    >
                      <Ionicons name="remove" size={20} color={theme.textPrimary} />
                    </TouchableOpacity>
                    <Text style={[theme.typography.headline, styles.stepperValue, { color: theme.textPrimary }]}>
                      {quantity}
                    </Text>
                    <TouchableOpacity
                      onPress={incrementQty}
                      style={[styles.stepperBtn, { borderLeftWidth: 1, borderLeftColor: theme.divider }]}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel="Increase quantity"
                    >
                      <Ionicons name="add" size={20} color={theme.textPrimary} />
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

                {!editingItem ? (
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

                {showSecondaryFields ? (
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
          title={editingItem ? 'Save' : 'Add item'}
          size="compact"
          onPress={() => {
            if (!loading) haptics.light();
            handleSubmit();
          }}
          disabled={loading}
          loading={loading}
        />
      </View>
    );

    return (
      <>
        <BottomSheet
          visible={visible}
          onClose={handleDismiss}
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
          padContent={false}
        >
            <View style={[styles.keyboardAvoidingSheet, styles.sheetLayout]}>
              <View style={[styles.sheetHeader, { backgroundColor: theme.surface, zIndex: 2 }]}>
                <Text style={[theme.typography.headline, { color: theme.textPrimary }]}>
                  {editingItem ? 'Edit item' : 'Add item'}
                </Text>
                <Pressable
                  style={({ pressed }) => [styles.zoneRow, pressed && { opacity: 0.75 }]}
                  onPress={openZonePicker}
                  accessibilityRole="button"
                  accessibilityLabel="Change store section"
                >
                  <View style={styles.zoneRowLabels}>
                    <Text style={[theme.typography.footnote, { color: theme.textSecondary }]}>Section</Text>
                    <Text
                      style={[theme.typography.body, { color: theme.textPrimary, marginTop: theme.spacing.xxs }]}
                      numberOfLines={1}
                    >
                      {sectionPickerLabel}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                </Pressable>
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
                      <RNScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
                      <View
                        style={{
                          borderRadius: theme.radius.card,
                          overflow: 'hidden',
                          backgroundColor: theme.surface,
                        }}
                      >
                        {UNITS_ALPHABETICAL.map((u, i) => (
                          <SelectorRow
                            key={u}
                            label={u}
                            selected={displayUnit === u}
                            showDivider={i > 0}
                            onPress={() => {
                              haptics.light();
                              commitUnitFromSheet(u);
                              setUnitSheetVisible(false);
                            }}
                          />
                        ))}
                      </View>
                    </RNScrollView>
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
