import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/ThemeContext';
import { spacing } from '../../design/spacing';
type ProgressHeaderProps = {
  checked: number;
  total: number;
};

export function ProgressHeader({ checked, total }: ProgressHeaderProps) {
  const theme = useTheme();
  const label = total === 0 ? 'No items' : `${checked} of ${total} checked`;
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Ionicons
          name="checkbox-outline"
          size={20}
          color={theme.textSecondary}
          style={styles.icon}
        />
        <Text style={[theme.typography.subhead, { color: theme.textSecondary }]}>
          {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
    paddingHorizontal: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: spacing.sm,
  },
});
