import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
  Keyboard,
} from 'react-native';
import { ScrollView, Pressable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from '../ui/BottomSheet';
import { useTheme } from '../../design/ThemeContext';
import { PrimaryButton } from '../ui/PrimaryButton';
import { TextField } from '../ui/TextField';
import { UnitSelectionList } from '../ui/UnitSelectionList';
import { useHaptics } from '../../hooks/useHaptics';
import { UNITS, type Unit } from '../../data/units';
import { ZONE_LABELS, ZONE_ICONS } from '../../data/zone';
import type { ParsedListItem } from '../../types/api';
import { titleCaseWords } from '../../utils/titleCaseWords';

export type SmartAddReviewSheetProps = {
  visible: boolean;
  items: ParsedListItem[];
  onCancel: () => void;
  onConfirm: (items: ParsedListItem[]) => Promise<void> | void;
  /** Called after the sheet's dismiss animation finishes. */
  onDismissed?: () => void;
};

type EditableRow = ParsedListItem & { _rowId: string };

/**
 * Review sheet shown after Smart Add parses free-text into structured list items.
 * Users can edit name, quantity, unit, and remove rows before bulk-inserting into the list.
 * Zones are shown as read-only chips for v1 (users can re-categorize after insert via the
 * existing long-press → edit flow if the AI got it wrong).
 */
export function SmartAddReviewSheet({
  visible,
  items,
  onCancel,
  onConfirm,
  onDismissed,
}: SmartAddReviewSheetProps) {
  const theme = useTheme();
  const haptics = useHaptics();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const [rows, setRows] = useState<EditableRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unitSheetForRowId, setUnitSheetForRowId] = useState<string | null>(null);

  // Seed editable rows each time we open the sheet with a new parse result.
  useEffect(() => {
    if (visible) {
      setRows(items.map((it, i) => ({ ...it, _rowId: `r${i}` })));
      setError(null);
      setUnitSheetForRowId(null);
    }
  }, [visible, items]);

  const unitRowCurrent = useMemo(
    () => rows.find((r) => r._rowId === unitSheetForRowId) ?? null,
    [rows, unitSheetForRowId]
  );

  const updateRow = useCallback(
    (rowId: string, patch: Partial<EditableRow>) => {
      setRows((prev) => prev.map((r) => (r._rowId === rowId ? { ...r, ...patch } : r)));
    },
    []
  );

  const removeRow = useCallback(
    (rowId: string) => {
      haptics.light();
      setRows((prev) => prev.filter((r) => r._rowId !== rowId));
    },
    [haptics]
  );

  const handleConfirm = useCallback(async () => {
    if (rows.length === 0) {
      setError('No items to add.');
      return;
    }

    const clean = rows
      .map((r) => {
        const name = (r.name ?? '').trim();
        if (!name) return null;
        const qty = Number.isFinite(r.quantity) && r.quantity > 0 ? r.quantity : 1;
        const u = (r.unit ?? 'ea').toString().toLowerCase();
        const unit = UNITS.includes(u as Unit) ? u : 'ea';
        const normalized = (r.normalized_name ?? name).trim().toLowerCase().replace(/\s+/g, ' ');
        return {
          name: titleCaseWords(name),
          normalized_name: normalized || name,
          quantity: qty,
          unit,
          zone_key: r.zone_key,
          category: r.category,
        } satisfies ParsedListItem;
      })
      .filter((x): x is ParsedListItem => x !== null);

    if (clean.length === 0) {
      setError('Every row is empty — add a name or cancel.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await onConfirm(clean);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add items');
    } finally {
      setBusy(false);
    }
  }, [rows, onConfirm]);

  const scrollMaxHeight = Math.max(220, windowHeight * 0.7 - 180);
  const footerPaddingBottom = Math.max(insets.bottom, theme.spacing.sm);
  const addButtonLabel =
    rows.length === 1 ? 'Add 1 item' : `Add ${rows.length} items`;

  const openUnitSheetFor = useCallback(
    (rowId: string) => {
      haptics.light();
      Keyboard.dismiss();
      setUnitSheetForRowId(rowId);
    },
    [haptics]
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={onCancel}
      onDismissed={onDismissed}
      onExitAnimationStart={() => Keyboard.dismiss()}
      size="form"
      compactHeader
      surfaceVariant="solid"
      presentationVariant="form"
      padContent={false}
      testID="smart-add-review-sheet"
    >
      <View style={[styles.sheetLayout, { paddingHorizontal: 0 }]}>
        <View style={[styles.header, { backgroundColor: theme.surface, paddingHorizontal: theme.spacing.md }]}>
          <View style={styles.headerRow}>
            <Text style={[theme.typography.title3, { color: theme.textPrimary }]}>Review items</Text>
            <Pressable
              onPress={onCancel}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={[theme.typography.body, { color: theme.accent }]}>Cancel</Text>
            </Pressable>
          </View>
          <Text
            style={[
              theme.typography.footnote,
              { color: theme.textSecondary, marginTop: theme.spacing.xs },
            ]}
          >
            {rows.length === 0
              ? 'Nothing to add. Tap Cancel to edit your description.'
              : 'Edit names, quantities, and units. Swipe or tap the trash to remove.'}
          </Text>
        </View>

        {error ? (
          <View
            style={[
              styles.errorBanner,
              {
                backgroundColor: theme.danger + '15',
                marginHorizontal: theme.spacing.md,
                marginTop: theme.spacing.sm,
                borderRadius: theme.radius.sm,
              },
            ]}
          >
            <Ionicons
              name="alert-circle-outline"
              size={16}
              color={theme.danger}
              style={{ marginRight: theme.spacing.sm }}
            />
            <Text style={[theme.typography.footnote, { color: theme.danger, flex: 1 }]}>{error}</Text>
          </View>
        ) : null}

        <ScrollView
          style={{ maxHeight: scrollMaxHeight }}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.md,
            paddingTop: theme.spacing.md,
            paddingBottom: theme.spacing.xs,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {rows.map((row) => {
            const u = (row.unit ?? 'ea').toString().toLowerCase();
            const displayUnit = UNITS.includes(u as Unit) ? u : 'ea';
            return (
              <View
                key={row._rowId}
                style={[
                  styles.rowCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.divider,
                    borderRadius: theme.radius.card,
                    padding: theme.spacing.md,
                    marginBottom: theme.spacing.sm,
                  },
                ]}
                accessible
                accessibilityLabel={`Item ${row.name}, quantity ${row.quantity} ${displayUnit}, section ${ZONE_LABELS[row.zone_key]}`}
              >
                <View style={styles.rowTopLine}>
                  <View
                    style={[
                      styles.zoneChip,
                      {
                        backgroundColor: theme.background,
                        borderColor: theme.divider,
                        borderRadius: theme.radius.full,
                        paddingHorizontal: theme.spacing.sm,
                        paddingVertical: theme.spacing.xs,
                      },
                    ]}
                    accessibilityLabel={`Section ${ZONE_LABELS[row.zone_key]}`}
                  >
                    <Ionicons
                      name={ZONE_ICONS[row.zone_key]}
                      size={12}
                      color={theme.textSecondary}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[theme.typography.footnote, { color: theme.textSecondary }]}
                      numberOfLines={1}
                    >
                      {ZONE_LABELS[row.zone_key]}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => removeRow(row._rowId)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${row.name}`}
                    style={styles.removeBtn}
                  >
                    <Ionicons name="trash-outline" size={18} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>

                <TextField
                  value={row.name}
                  onChangeText={(v) => updateRow(row._rowId, { name: v })}
                  placeholder="Item name"
                  formatOnBlur="titleWords"
                  containerStyle={{ marginBottom: theme.spacing.sm }}
                  {...(Platform.OS === 'ios'
                    ? { multiline: true, scrollEnabled: false, blurOnSubmit: false }
                    : {})}
                />

                <View style={styles.qtyRow}>
                  <Text
                    style={[theme.typography.footnote, { color: theme.textSecondary, width: 32 }]}
                  >
                    Qty
                  </Text>
                  <View
                    style={[
                      styles.stepper,
                      {
                        backgroundColor: theme.background,
                        borderColor: theme.divider,
                        borderRadius: theme.radius.input,
                      },
                    ]}
                  >
                    <TouchableOpacity
                      onPress={() => {
                        haptics.light();
                        updateRow(row._rowId, { quantity: Math.max(1, row.quantity - 1) });
                      }}
                      style={styles.stepperBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel="Decrease quantity"
                    >
                      <Ionicons name="remove" size={18} color={theme.textPrimary} />
                    </TouchableOpacity>
                    <Text
                      style={[
                        theme.typography.body,
                        { color: theme.textPrimary, minWidth: 36, textAlign: 'center' },
                      ]}
                    >
                      {row.quantity}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        haptics.light();
                        updateRow(row._rowId, { quantity: row.quantity + 1 });
                      }}
                      style={styles.stepperBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel="Increase quantity"
                    >
                      <Ionicons name="add" size={18} color={theme.textPrimary} />
                    </TouchableOpacity>
                  </View>

                  <Pressable
                    onPress={() => openUnitSheetFor(row._rowId)}
                    style={({ pressed }) => [
                      styles.unitDropdown,
                      {
                        backgroundColor: theme.background,
                        borderColor: theme.divider,
                        borderRadius: theme.radius.input,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Change unit, current ${displayUnit}`}
                  >
                    <Text style={[theme.typography.body, { color: theme.textPrimary }]}>
                      {displayUnit}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View
          style={[
            styles.footerCta,
            {
              backgroundColor: theme.surface,
              paddingHorizontal: theme.spacing.md,
              paddingTop: theme.spacing.sm,
              paddingBottom: footerPaddingBottom,
            },
          ]}
        >
          <PrimaryButton
            title={addButtonLabel}
            size="compact"
            onPress={() => {
              if (!busy) haptics.light();
              handleConfirm();
            }}
            disabled={busy || rows.length === 0}
            loading={busy}
          />
        </View>

        {unitSheetForRowId && unitRowCurrent ? (
          <View style={styles.unitOverlayRoot} pointerEvents="box-none">
            <Pressable
              style={[StyleSheet.absoluteFill, styles.unitOverlayBackdrop]}
              onPress={() => setUnitSheetForRowId(null)}
            />
            <View
              style={[
                styles.unitOverlayPanel,
                theme.shadows.floating,
                {
                  backgroundColor: theme.surface,
                  borderTopLeftRadius: theme.radius.sheet,
                  borderTopRightRadius: theme.radius.sheet,
                  paddingHorizontal: theme.spacing.md,
                  paddingTop: theme.spacing.lg,
                  paddingBottom: Math.max(insets.bottom, theme.spacing.md),
                },
              ]}
            >
              <View style={{ gap: theme.spacing.md }}>
                <Text style={[theme.typography.headline, { color: theme.textPrimary }]}>Unit</Text>
                <UnitSelectionList
                  value={(unitRowCurrent.unit ?? 'ea').toLowerCase()}
                  onSelect={(selectedUnit) => {
                    haptics.light();
                    updateRow(unitRowCurrent._rowId, { unit: selectedUnit });
                    setUnitSheetForRowId(null);
                  }}
                />
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetLayout: {
    alignSelf: 'stretch',
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 0,
    position: 'relative',
  },
  header: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  rowCard: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  zoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '70%',
  },
  removeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  stepperBtn: {
    width: 40,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unitDropdown: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  footerCta: {
    alignSelf: 'stretch',
    flexShrink: 0,
  },
  unitOverlayRoot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    elevation: 1000,
    justifyContent: 'flex-end',
  },
  unitOverlayBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  unitOverlayPanel: {
    overflow: 'visible',
  },
});
