import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../../design/ThemeContext';
import { SelectorRow } from './SelectorRow';
import {
  normalizeUnitValue,
  UNIT_SELECTION_MAX_HEIGHT,
  UNITS_ALPHABETICAL,
} from './unitSelection';
import type { Unit } from '../../data/units';
import { radius } from '../../design/radius';

type UnitSelectionListProps = {
  value: string;
  onSelect: (unit: Unit) => void;
  maxHeight?: number;
  showsVerticalScrollIndicator?: boolean;
};

export function UnitSelectionList({
  value,
  onSelect,
  maxHeight = UNIT_SELECTION_MAX_HEIGHT,
  showsVerticalScrollIndicator = false,
}: UnitSelectionListProps) {
  const theme = useTheme();
  const currentUnit = normalizeUnitValue(value);

  return (
    <ScrollView style={[styles.scroll, { maxHeight }]} showsVerticalScrollIndicator={showsVerticalScrollIndicator}>
      <View style={[styles.groupedCard, { backgroundColor: theme.surface }]}>
        {UNITS_ALPHABETICAL.map((unit, index) => (
          <SelectorRow
            key={unit}
            label={unit}
            selected={currentUnit === unit}
            onPress={() => onSelect(unit)}
            showDivider={index > 0}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    maxHeight: UNIT_SELECTION_MAX_HEIGHT,
  },
  groupedCard: {
    borderRadius: radius.card,
    overflow: 'hidden',
    borderWidth: 0,
    borderColor: 'transparent',
  },
});
