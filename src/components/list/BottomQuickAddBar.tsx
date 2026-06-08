import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useTheme } from '../../design/ThemeContext';
import { GlassControl, GlassInputBar, GlassMenu } from '../ui/GlassPrimitives';
import { AnimatedQuantityValue } from '../ui/AnimatedQuantityValue';
import { PressableScale } from '../ui/PressableScale';
import { AppConfirmationDialog } from '../ui/AppConfirmationDialog';
import { useHaptics } from '../../hooks/useHaptics';
import {
  COMPOSER_KEYBOARD_EDGE_GAP,
  useKeyboardFrameLift,
} from '../../hooks/useKeyboardFrameLift';
import { KeyboardComposerHost } from 'listio-keyboard-composer';
import {
  parseItems,
  parseSingleEntry,
  parseBulkToItems,
  type ParsedItem,
} from '../../utils/parseItems';
import { titleCaseWords } from '../../utils/titleCaseWords';
import { UNITS_ALPHABETICAL } from '../ui/unitSelection';
import type { Unit } from '../../data/units';
import type { ZoneKey } from '../../types/models';
import { QuickAddSuggestionStack, quickAddSuggestionStackHeight } from './QuickAddSuggestionStack';
import {
  searchItemNameSuggestions,
  type ItemNameSuggestion,
} from '../../services/itemNameSuggestions';
import { loadRecentItemsForSuggestions, type RecentItem } from '../../services/recentItemsStore';
import { resolveCategoryFast } from '../../services/aiCategoryCache';
import { categorizeItems } from '../../services/aiService';

export interface BottomQuickAddBarHandle {
  focus: () => void;
}

export type BottomQuickAddSubmitOptions = {
  /** Invoked when the list cache shows the new row (optimistic) or insert succeeds without an optimistic write. */
  onOptimisticListInsert?: () => void;
};

type BottomQuickAddBarProps = {
  onSubmit: (
    items: ParsedItem[],
    zoneOverride: ZoneKey | null,
    opts?: BottomQuickAddSubmitOptions
  ) => Promise<void>;
  disabled?: boolean;
  /** Names already on the list — used for re-add suggestions. */
  listItemNames?: string[];
  storeType?: string;
  zoneLabelsInOrder?: string[];
};

/** List bottom padding: composer + optional suggestion stack + error line. */
export function bottomQuickAddClearance(suggestionCount = 0): number {
  return (
    BOTTOM_QUICK_ADD_BAR_CLEARANCE +
    quickAddSuggestionStackHeight(suggestionCount) +
    (suggestionCount > 0 ? 8 : 0)
  );
}

const CONTROL_SIZE = 44;
/** Slightly smaller than qty/unit so the row reads as one height with lighter send affordance. */
const SEND_BUTTON_SIZE = 36;
const SEND_ICON_SIZE = 18;
/** Gap between the quick bar and the tab bar or keyboard (pt). */
export const COMPOSER_EDGE_GAP = COMPOSER_KEYBOARD_EDGE_GAP;
/** Space for the composer row, inline error text, and the edge gap used by the overlay. */
export const BOTTOM_QUICK_ADD_BAR_CLEARANCE = CONTROL_SIZE + 28 + COMPOSER_EDGE_GAP;
const UNIT_MENU_MAX_HEIGHT = 188;

export const BottomQuickAddBar = forwardRef(function BottomQuickAddBar(
  {
    onSubmit,
    disabled = false,
    listItemNames = [],
    storeType,
    zoneLabelsInOrder,
  }: BottomQuickAddBarProps,
  ref: React.ForwardedRef<BottomQuickAddBarHandle>
) {
  const theme = useTheme();
  const tabBarHeight = useBottomTabBarHeight();
  const haptics = useHaptics();
  const inputRef = useRef<TextInput>(null);
  const qtyInputRef = useRef<TextInput>(null);
  const [text, setText] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [quantityDraft, setQuantityDraft] = useState('1');
  const quantityDraftRef = useRef('1');
  const [quantityEditing, setQuantityEditing] = useState(false);
  const [unit, setUnit] = useState<Unit>('ea');
  const [unitMenuOpen, setUnitMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmItems, setConfirmItems] = useState<ParsedItem[] | null>(null);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const prewarmAbortRef = useRef<{ cancelled: boolean } | null>(null);

  useEffect(() => {
    void loadRecentItemsForSuggestions().then(setRecentItems);
  }, []);

  /** Tab bar is overlaid; quick bar rests `COMPOSER_EDGE_GAP` pt above it (see useKeyboardFrameLift). */
  const trimmed = text.trim();
  const canSubmit = trimmed.length > 0 && !loading && !disabled;
  /** Keep accent styling while `loading` so the send control stays visible (spinner on green). */
  const sendAccent = trimmed.length > 0 && !disabled;
  const suggestions = useMemo(
    () =>
      disabled || unitMenuOpen || trimmed.length < 1
        ? []
        : searchItemNameSuggestions(trimmed, {
            recentItems,
            listItemNames,
          }),
    [disabled, unitMenuOpen, trimmed, recentItems, listItemNames]
  );
  const showSuggestions = suggestions.length > 0 && !unitMenuOpen && !disabled;

  const prewarmCategorize = useCallback(
    (name: string) => {
      if (resolveCategoryFast(name)) return;
      void categorizeItems([name], storeType, zoneLabelsInOrder).catch(() => undefined);
    },
    [storeType, zoneLabelsInOrder]
  );

  const handleKeyboardHidden = useCallback(() => setQuantityEditing(false), []);

  const stickyBarStyle = useKeyboardFrameLift({
    tabBarHeight,
    edgeGap: COMPOSER_EDGE_GAP,
    onKeyboardHidden: handleKeyboardHidden,
  });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          ...StyleSheet.absoluteFillObject,
          justifyContent: 'flex-end',
          zIndex: 30,
          elevation: 30,
        },
        bottomWrap: {
          paddingHorizontal: theme.spacing.md,
        },
        dismissLayer: {
          ...StyleSheet.absoluteFillObject,
        },
        unitMenuWrap: {
          alignSelf: 'flex-start',
          width: 156,
          height: UNIT_MENU_MAX_HEIGHT,
          marginLeft: CONTROL_SIZE + theme.spacing.sm,
          marginBottom: theme.spacing.sm,
        },
        unitScroll: {
          maxHeight: UNIT_MENU_MAX_HEIGHT,
        },
        composerCluster: {
          alignSelf: 'stretch',
          borderRadius: CONTROL_SIZE / 2,
          ...theme.shadows.chrome,
        },
        composerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.xs,
        },
        controlGlass: {
          width: CONTROL_SIZE,
          height: CONTROL_SIZE,
        },
        unitGlass: {
          height: CONTROL_SIZE,
          minWidth: 48,
        },
        barGlass: {
          flex: 1,
          height: CONTROL_SIZE,
        },
        barRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.xs,
          minHeight: CONTROL_SIZE,
          paddingHorizontal: theme.spacing.xs,
          paddingVertical: 0,
        },
        circle: {
          width: CONTROL_SIZE,
          height: CONTROL_SIZE,
          borderRadius: CONTROL_SIZE / 2,
          alignItems: 'center',
          justifyContent: 'center',
        },
        unitControl: {
          minWidth: 48,
          height: CONTROL_SIZE,
          borderRadius: CONTROL_SIZE / 2,
          paddingHorizontal: theme.spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        },
        /** Same rhythm as `RecipeSearchBar` / `TextField`: body type + vertical padding centers the line in the track. */
        input: {
          flex: 1,
          minHeight: CONTROL_SIZE,
          maxHeight: CONTROL_SIZE,
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: theme.spacing.sm,
          textAlign: 'left',
          textAlignVertical: 'center',
          ...Platform.select({
            android: { includeFontPadding: false },
          }),
        },
        qtyInput: {
          width: CONTROL_SIZE,
          minHeight: CONTROL_SIZE,
          padding: 0,
          textAlign: 'center',
        },
        sendButton: {
          width: SEND_BUTTON_SIZE,
          height: SEND_BUTTON_SIZE,
          borderRadius: SEND_BUTTON_SIZE / 2,
          alignItems: 'center',
          justifyContent: 'center',
        },
        errorText: {
          marginTop: theme.spacing.xs,
          marginHorizontal: theme.spacing.lg,
          textAlign: 'center',
        },
        unitRow: {
          minHeight: 44,
          paddingHorizontal: theme.spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        unitDivider: {
          height: StyleSheet.hairlineWidth,
          marginLeft: theme.spacing.md,
        },
      }),
    [theme]
  );

  useImperativeHandle(
    ref,
    () => ({
      focus: () => inputRef.current?.focus(),
    }),
    []
  );

  const commitQuantity = useCallback(() => {
    const next = Number.parseFloat(quantityDraftRef.current);
    if (Number.isFinite(next) && next > 0) {
      const rounded = Math.round(next * 100) / 100;
      setQuantity(rounded);
      setQuantityDraft(String(rounded));
      quantityDraftRef.current = String(rounded);
      setQuantityEditing(false);
      return rounded;
    } else {
      setQuantityDraft(String(quantity));
      quantityDraftRef.current = String(quantity);
      setQuantityEditing(false);
      return quantity;
    }
  }, [quantity]);

  const beginQuantityEdit = useCallback(() => {
    haptics.light();
    setUnitMenuOpen(false);
    setQuantityEditing(true);
    requestAnimationFrame(() => qtyInputRef.current?.focus());
  }, [haptics]);

  const toggleUnitMenu = useCallback(() => {
    haptics.light();
    setQuantityEditing(false);
    setUnitMenuOpen((open) => !open);
  }, [haptics]);

  const resetAfterSubmit = useCallback(() => {
    setText('');
    setQuantity(1);
    setQuantityDraft('1');
    quantityDraftRef.current = '1';
    setUnit('ea');
    setUnitMenuOpen(false);
    setError(null);
    void loadRecentItemsForSuggestions().then(setRecentItems);
  }, []);

  const submitParsedItems = useCallback(
    async (items: ParsedItem[]) => {
      if (items.length === 0) return;
      setLoading(true);
      setError(null);
      try {
        await onSubmit(items, null, {
          onOptimisticListInsert: () => {
            haptics.success();
            resetAfterSubmit();
          },
        });
      } catch (e) {
        if ((e as { code?: string })?.code !== 'DUPLICATE') {
          setError(e instanceof Error ? e.message : 'Failed to add item');
        }
      } finally {
        setLoading(false);
      }
    },
    [haptics, onSubmit, resetAfterSubmit]
  );

  const handleSubmit = useCallback(() => {
    if (!canSubmit) {
      if (!trimmed) setError('Enter an item');
      return;
    }

    const committedQuantity = commitQuantity();
    const raw = parseItems(trimmed);
    if (raw.length > 1) {
      const bulkText = raw.map((line) => titleCaseWords(line)).join('\n');
      const items = parseBulkToItems(bulkText);
      setConfirmItems(items);
      return;
    }

    const primary = titleCaseWords(trimmed);
    const parsed = parseSingleEntry(primary);
    if (!parsed.name || parsed.name === 'item') {
      setError('Enter a valid item');
      return;
    }
    void submitParsedItems([
      {
        ...parsed,
        quantity: committedQuantity,
        unit,
        substitute_allowed: true,
        priority: 'normal',
        is_recurring: false,
      },
    ]);
  }, [canSubmit, commitQuantity, submitParsedItems, trimmed, unit]);

  const handleSuggestionSelect = useCallback(
    (suggestion: ItemNameSuggestion) => {
      haptics.light();
      setText(suggestion.display_name);
      if (suggestion.last_unit) {
        setUnit(suggestion.last_unit as Unit);
      }
      setError(null);
      setUnitMenuOpen(false);
      prewarmCategorize(suggestion.display_name);
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [haptics, prewarmCategorize]
  );

  useEffect(() => {
    if (disabled || unitMenuOpen) return;
    if (trimmed.length < 3) return;
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
      void categorizeItems([name], storeType, zoneLabelsInOrder).catch(() => undefined);
    }, 600);

    return () => {
      clearTimeout(timeoutId);
      token.cancelled = true;
    };
  }, [disabled, unitMenuOpen, text, trimmed, storeType, zoneLabelsInOrder]);

  const bottomWrapStyle = [styles.bottomWrap, stickyBarStyle];

  const composerOverlay = (
    <>
      {unitMenuOpen ? (
        <Pressable
          style={styles.dismissLayer}
          onPress={() => setUnitMenuOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Dismiss unit menu"
        />
      ) : null}
      <Animated.View pointerEvents="box-none" style={bottomWrapStyle}>
          {unitMenuOpen ? (
            <GlassMenu style={[styles.unitMenuWrap, theme.shadows.chrome]}>
              <ScrollView
                style={styles.unitScroll}
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled"
              >
                {UNITS_ALPHABETICAL.map((candidate, index) => {
                  const selected = unit === candidate;
                  return (
                    <View key={candidate}>
                      {index > 0 ? (
                        <View style={[styles.unitDivider, { backgroundColor: theme.divider }]} />
                      ) : null}
                      <PressableScale
                        style={styles.unitRow}
                        pressedOpacity={0.9}
                        accessibilityRole="button"
                        accessibilityLabel={`Select ${candidate}`}
                        accessibilityState={{ selected }}
                        onPress={() => {
                          haptics.light();
                          setUnit(candidate);
                          setUnitMenuOpen(false);
                        }}
                      >
                        <Text
                          style={[
                            theme.typography.body,
                            {
                              color: selected ? theme.accent : theme.textPrimary,
                              fontWeight: selected ? '600' : '400',
                            },
                          ]}
                        >
                          {candidate}
                        </Text>
                        {selected ? (
                          <Ionicons name="checkmark-circle" size={20} color={theme.accent} />
                        ) : null}
                      </PressableScale>
                    </View>
                  );
                })}
              </ScrollView>
            </GlassMenu>
          ) : null}

          <QuickAddSuggestionStack
            suggestions={suggestions}
            visible={showSuggestions}
            onSelect={handleSuggestionSelect}
          />

          <View style={styles.composerCluster}>
            <View style={styles.composerRow}>
              <GlassControl shape="circle" size={CONTROL_SIZE} style={styles.controlGlass}>
                <PressableScale
                  style={styles.circle}
                  onPress={beginQuantityEdit}
                  accessibilityRole="button"
                  accessibilityLabel="Edit quantity"
                >
                  {quantityEditing ? (
                    <TextInput
                      ref={qtyInputRef}
                      value={quantityDraft}
                      onChangeText={(next) => {
                        quantityDraftRef.current = next;
                        setQuantityDraft(next);
                      }}
                      onBlur={commitQuantity}
                      onSubmitEditing={commitQuantity}
                      keyboardType="decimal-pad"
                      keyboardAppearance={theme.colorScheme}
                      selectTextOnFocus
                      style={[theme.typography.body, styles.qtyInput, { color: theme.textPrimary }]}
                    />
                  ) : (
                    <AnimatedQuantityValue
                      value={quantity}
                      style={[theme.typography.body, { color: theme.textPrimary, fontWeight: '600' }]}
                    />
                  )}
                </PressableScale>
              </GlassControl>

              <GlassControl style={styles.unitGlass}>
                <PressableScale
                  style={[
                    styles.unitControl,
                    unitMenuOpen && { backgroundColor: theme.accent + '18' },
                  ]}
                  onPress={toggleUnitMenu}
                  accessibilityRole="button"
                  accessibilityLabel="Change unit"
                  accessibilityState={{ expanded: unitMenuOpen }}
                >
                  <Text
                    style={[
                      theme.typography.footnote,
                      { color: unitMenuOpen ? theme.accent : theme.textPrimary, fontWeight: '600' },
                    ]}
                  >
                    {unit}
                  </Text>
                  <Ionicons
                    name={unitMenuOpen ? 'chevron-down' : 'chevron-up'}
                    size={14}
                    color={unitMenuOpen ? theme.accent : theme.textSecondary}
                  />
                </PressableScale>
              </GlassControl>

              <GlassInputBar style={styles.barGlass}>
                <View style={styles.barRow}>
                  <TextInput
                    ref={inputRef}
                    value={text}
                    onChangeText={(next) => {
                      setText(next);
                      setError(null);
                    }}
                    onFocus={() => setUnitMenuOpen(false)}
                    onSubmitEditing={handleSubmit}
                    placeholder="Add item"
                    placeholderTextColor={theme.textSecondary}
                    keyboardAppearance={theme.colorScheme}
                    returnKeyType="done"
                    blurOnSubmit={false}
                    style={[theme.typography.body, styles.input, { color: theme.textPrimary }]}
                  />

                  <PressableScale
                    style={[
                      styles.sendButton,
                      { backgroundColor: sendAccent ? theme.accent : theme.surfaceGlass },
                      !sendAccent && { opacity: 0.75 },
                    ]}
                    hitSlop={{ top: 4, right: 4, bottom: 4, left: 4 }}
                    onPress={() => {
                      if (canSubmit) haptics.light();
                      handleSubmit();
                    }}
                    disabled={loading || disabled}
                    accessibilityRole="button"
                    accessibilityLabel="Add item"
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color={theme.onAccent} />
                    ) : (
                      <Ionicons
                        name="arrow-up"
                        size={SEND_ICON_SIZE}
                        color={sendAccent ? theme.onAccent : theme.textSecondary}
                      />
                    )}
                  </PressableScale>
                </View>
              </GlassInputBar>
            </View>
          </View>
          {error ? (
            <Text style={[theme.typography.footnote, styles.errorText, { color: theme.danger }]}>
              {error}
            </Text>
          ) : null}
      </Animated.View>
    </>
  );

  return (
    <>
      {Platform.OS === 'ios' ? (
        <KeyboardComposerHost pointerEvents="box-none" style={styles.overlay}>
          {composerOverlay}
        </KeyboardComposerHost>
      ) : (
        <Animated.View pointerEvents="box-none" style={styles.overlay}>
          {composerOverlay}
        </Animated.View>
      )}

      <AppConfirmationDialog
        visible={confirmItems != null}
        onClose={() => setConfirmItems(null)}
        title="Add items"
        message={confirmItems ? `Add ${confirmItems.length} items to your list?` : undefined}
        buttons={[
          { label: 'Cancel', onPress: () => {}, cancel: true },
          {
            label: 'Add',
            onPress: () => {
              if (confirmItems) void submitParsedItems(confirmItems);
            },
          },
        ]}
      />
    </>
  );
});
