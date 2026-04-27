import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../design/ThemeContext';
import { BottomSheet } from '../ui/BottomSheet';
import { SelectorRow } from '../ui/SelectorRow';
import type { ZoneKey } from '../../types/models';
import { ZONE_KEYS, ZONE_LABELS } from '../../data/zone';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';

function orderedZoneKeys(zoneOrder?: ZoneKey[]): ZoneKey[] {
  if (!zoneOrder?.length) return [...ZONE_KEYS];
  const seen = new Set<ZoneKey>();
  const out: ZoneKey[] = [];
  for (const z of zoneOrder) {
    if (ZONE_KEYS.includes(z) && !seen.has(z)) {
      seen.add(z);
      out.push(z);
    }
  }
  for (const z of ZONE_KEYS) {
    if (!seen.has(z)) out.push(z);
  }
  return out;
}

export type ListItemZonePickerPanelProps = {
  /** When true, first option is Auto (AI-suggested section). When false (e.g. edit), only explicit sections. */
  allowAuto: boolean;
  /** Selected section, or null when Auto is selected (only when allowAuto). */
  value: ZoneKey | null;
  /** Called when the user picks an option. */
  onCommit: (zone: ZoneKey | null) => void;
  /** Order for section rows; falls back to ZONE_KEYS. */
  zoneOrder?: ZoneKey[];
  /**
   * `modal` = standalone sheet with “Section” title. `embedded` = inline under existing “Section” row (no duplicate title).
   */
  layout?: 'modal' | 'embedded';
};

/**
 * Section list for store section selection (used inside a sheet or inline overlay).
 */
export function ListItemZonePickerPanel({
  allowAuto,
  value,
  onCommit,
  zoneOrder,
  layout = 'modal',
}: ListItemZonePickerPanelProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const keys = useMemo(() => orderedZoneKeys(zoneOrder), [zoneOrder]);
  const scrollMax = Math.min(windowHeight * 0.5, 420);
  const embedded = layout === 'embedded';

  return (
    <View>
      {embedded ? (
        <View style={styles.embeddedGrabberWrap} accessibilityElementsHidden>
          <View style={[styles.embeddedGrabber, { backgroundColor: theme.divider }]} />
        </View>
      ) : (
        <View style={styles.header}>
          <Text style={[theme.typography.headline, { color: theme.textPrimary }]}>Section</Text>
        </View>
      )}
      <ScrollView
        style={{ maxHeight: scrollMax }}
        contentContainerStyle={{
          paddingBottom: embedded ? theme.spacing.sm : Math.max(insets.bottom, theme.spacing.sm),
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        <View style={[styles.actions, { backgroundColor: theme.surface }]}>
          {allowAuto ? (
            <SelectorRow
              label="Auto (suggested)"
              secondary={
                embedded
                  ? 'AI picks the section using your store’s layout order'
                  : 'Use AI to pick the section from the item name'
              }
              selected={value === null}
              onPress={() => onCommit(null)}
              showDivider={false}
            />
          ) : null}
          {keys.map((key, i) => (
            <SelectorRow
              key={key}
              label={ZONE_LABELS[key]}
              selected={value === key}
              onPress={() => onCommit(key)}
              showDivider={allowAuto ? true : i > 0}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

type ListItemZoneSheetProps = {
  visible: boolean;
  onClose: () => void;
  allowAuto: boolean;
  value: ZoneKey | null;
  onSelect: (zone: ZoneKey | null) => void;
  zoneOrder?: ZoneKey[];
};

/**
 * Standalone modal bottom sheet for list item store section selection.
 */
export function ListItemZoneSheet({
  visible,
  onClose,
  allowAuto,
  value,
  onSelect,
  zoneOrder,
}: ListItemZoneSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <ListItemZonePickerPanel
        allowAuto={allowAuto}
        value={value}
        zoneOrder={zoneOrder}
        onCommit={(z) => {
          onSelect(z);
          onClose();
        }}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.lg,
  },
  embeddedGrabberWrap: {
    alignItems: 'center',
    paddingBottom: spacing.sm,
  },
  embeddedGrabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  actions: {
    overflow: 'hidden',
    borderRadius: radius.card,
  },
});
