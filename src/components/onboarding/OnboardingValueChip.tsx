import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/ThemeContext';
import { radius } from '../../design/radius';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
};

/** Compact value callout — icon + short label. */
export function OnboardingValueChip({ icon, label }: Props) {
  const theme = useTheme();
  return (
    <View style={[styles.chip, { backgroundColor: theme.accent + '14', borderColor: theme.accent + '30' }]}>
      <Ionicons name={icon} size={14} color={theme.accent} />
      <Text style={[theme.typography.caption2, { color: theme.accent, fontWeight: '600', marginLeft: 6 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
