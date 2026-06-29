import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { useTheme } from '../../design/ThemeContext';
import { useHaptics } from '../../hooks/useHaptics';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';
import type { ListItem } from '../../types/models';

type Props = {
  item: ListItem | null;
  onClose: () => void;
  onSave: (item: ListItem, newValue: number | null) => void;
};

const MAX_DISPLAY_LENGTH = 7;

const NUMPAD_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', '⌫'],
] as const;

function appendKey(current: string, key: string): string {
  if (key === '⌫') {
    return current.length <= 1 ? '0' : current.slice(0, -1);
  }
  if (key === '.') {
    if (current.includes('.')) return current;
    if (current.length >= MAX_DISPLAY_LENGTH) return current;
    return current === '0' ? '0.' : current + '.';
  }
  if (current === '0' && key !== '.') {
    return key;
  }
  if (current.length >= MAX_DISPLAY_LENGTH) return current;
  const dotIdx = current.indexOf('.');
  if (dotIdx !== -1 && current.length - dotIdx > 2) return current;
  return current + key;
}

export function QuantityEditSheet({ item, onClose, onSave }: Props) {
  const theme = useTheme();
  const haptics = useHaptics();
  const initialValue = item?.quantity_value != null ? String(item.quantity_value) : '0';
  const [display, setDisplay] = useState(initialValue);

  const handleKeyPress = useCallback(
    (key: string) => {
      haptics.selection();
      setDisplay((prev) => appendKey(prev, key));
    },
    [haptics]
  );

  const handleDone = useCallback(() => {
    if (!item) return;
    const parsed = parseFloat(display);
    onSave(item, isNaN(parsed) || parsed <= 0 ? null : parsed);
  }, [item, display, onSave]);

  // Reset display when item changes
  React.useEffect(() => {
    setDisplay(item?.quantity_value != null ? String(item.quantity_value) : '0');
  }, [item?.id, item?.quantity_value]);

  const unit = item?.quantity_unit ?? '';
  const name = item?.name ?? '';

  return (
    <BottomSheet
      visible={item != null}
      onClose={onClose}
      interactiveDismiss
      surfaceVariant="solid"
      compactHeader
      formHugContent
      size="form"
    >
      <View style={styles.container}>
        <Text
          style={[theme.typography.caption1, styles.itemName, { color: theme.textSecondary }]}
          numberOfLines={1}
        >
          {name}
        </Text>
        <View style={styles.valueRow}>
          <Text style={[theme.typography.largeTitle, styles.displayValue, { color: theme.textPrimary }]}>
            {display}
          </Text>
          {unit ? (
            <Text style={[theme.typography.title2, styles.unitLabel, { color: theme.textSecondary }]}>
              {unit}
            </Text>
          ) : null}
        </View>

        <View style={styles.numpad}>
          {NUMPAD_KEYS.map((row, ri) => (
            <View key={ri} style={styles.numpadRow}>
              {row.map((key) => (
                <Pressable
                  key={key}
                  style={({ pressed }) => [
                    styles.numpadKey,
                    { backgroundColor: pressed ? theme.textSecondary + '20' : theme.textSecondary + '10' },
                  ]}
                  onPress={() => handleKeyPress(key)}
                  accessibilityRole="button"
                  accessibilityLabel={key === '⌫' ? 'backspace' : key}
                >
                  <Text style={[theme.typography.title2, styles.numpadKeyText, { color: theme.textPrimary }]}>
                    {key}
                  </Text>
                </Pressable>
              ))}
            </View>
          ))}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.doneBtn,
            { backgroundColor: pressed ? theme.accent + 'dd' : theme.accent },
          ]}
          onPress={handleDone}
          accessibilityRole="button"
          accessibilityLabel="Save quantity"
        >
          <Text style={[theme.typography.headline, styles.doneBtnText, { color: theme.onAccent }]}>
            Done
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  itemName: {
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  displayValue: {
    fontVariant: ['tabular-nums'],
    minWidth: 60,
    textAlign: 'right',
  },
  unitLabel: {
    opacity: 0.6,
  },
  numpad: {
    gap: spacing.xs,
    marginTop: spacing.xxs,
  },
  numpadRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  numpadKey: {
    flex: 1,
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numpadKeyText: {
    fontVariant: ['tabular-nums'],
  },
  doneBtn: {
    height: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  doneBtnText: {
    fontWeight: '600',
  },
});
