import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/ThemeContext';
import { ListSection } from '../ui/ListSection';
import { spacing } from '../../design/spacing';

type CustomAisleSectionProps = {
  name: string;
};

/** Empty section placeholder for custom sections in List tab. */
export function CustomAisleSection({ name }: CustomAisleSectionProps) {
  const theme = useTheme();

  return (
    <ListSection glass={false} overflowVisible style={styles.section}>
      <View style={styles.header}>
        <Ionicons name="pricetag-outline" size={18} color={theme.textSecondary} style={styles.icon} />
        <Text
          style={[
            theme.typography.caption1,
            {
              color: theme.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            },
          ]}
        >
          {name}
        </Text>
        <Text style={[theme.typography.footnote, { color: theme.textSecondary }]}>0 items</Text>
      </View>
    </ListSection>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.lg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: 0,
  },
  icon: { marginRight: spacing.sm },
});
