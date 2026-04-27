import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../design/ThemeContext';
import { BottomSheet } from './BottomSheet';
import type { Unit } from '../../data/units';
import { useHaptics } from '../../hooks/useHaptics';
import { UnitSelectionList } from './UnitSelectionList';

type UnitPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  value: string;
  onSelect: (unit: Unit) => void;
};

/**
 * Shared unit selector. Uses AppBottomSheet. Same selector in List and Meals.
 * Do not stack this sheet on top of another RN `Modal` (e.g. Add item) — iOS rejects nested modal presentation.
 */
export function UnitPickerSheet({
  visible,
  onClose,
  value,
  onSelect,
}: UnitPickerSheetProps) {
  const theme = useTheme();
  const haptics = useHaptics();

  const handleSelect = (u: Unit) => {
    haptics.light();
    onSelect(u);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} surfaceVariant="solid" presentationVariant="action">
      <View style={{ gap: theme.spacing.md }}>
        <Text style={[theme.typography.headline, { color: theme.textPrimary }]}>Unit</Text>
        <UnitSelectionList value={value} onSelect={handleSelect} />
      </View>
    </BottomSheet>
  );
}
