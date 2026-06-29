import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../design/ThemeContext';
import { GlassInputBar } from '../ui/GlassPrimitives';
import { PressableScale } from '../ui/PressableScale';
import type { ItemNameSuggestion } from '../../services/itemNameSuggestions';

const ROW_HEIGHT = 44;

type QuickAddSuggestionStackProps = {
  suggestions: ItemNameSuggestion[];
  visible: boolean;
  onSelect: (suggestion: ItemNameSuggestion) => void;
};

export function quickAddSuggestionStackHeight(count: number): number {
  if (count <= 0) return 0;
  return count * ROW_HEIGHT + Math.max(0, count - 1) * 8;
}

export function QuickAddSuggestionStack({
  suggestions,
  visible,
  onSelect,
}: QuickAddSuggestionStackProps) {
  const theme = useTheme();

  const rowRadius = ROW_HEIGHT / 2;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        stack: {
          alignSelf: 'stretch',
          gap: theme.spacing.sm,
          marginBottom: theme.spacing.sm,
        },
        /** Shadow on a wrapper — GlassView uses overflow:hidden and clips box shadows. */
        rowShadow: {
          alignSelf: 'stretch',
          borderRadius: rowRadius,
          ...theme.shadows.chrome,
        },
        rowGlass: {
          height: ROW_HEIGHT,
        },
        rowInner: {
          flex: 1,
          minHeight: ROW_HEIGHT,
          paddingHorizontal: theme.spacing.md,
          justifyContent: 'center',
        },
        label: {
          flexShrink: 1,
        },
      }),
    [rowRadius, theme]
  );

  if (!visible || suggestions.length === 0) return null;

  return (
    <View style={styles.stack} accessibilityRole="list">
      {suggestions.map((item) => (
        <View
          key={`${item.source}-${item.normalized_name}-${item.isTypedFallback ? 'typed' : 'match'}`}
          style={styles.rowShadow}
        >
          <GlassInputBar style={styles.rowGlass}>
            <PressableScale
              style={styles.rowInner}
              onPress={() => onSelect(item)}
              accessibilityRole="button"
              accessibilityLabel={
                item.isTypedFallback ? `Add ${item.display_name}` : `Use ${item.display_name}`
              }
            >
              {item.isTypedFallback ? (
                <Text
                  style={[theme.typography.body, styles.label, { color: theme.textPrimary }]}
                  numberOfLines={1}
                >
                  Add{' '}
                  <Text style={{ fontWeight: '600' }}>{item.display_name}</Text>
                </Text>
              ) : (
                <Text
                  style={[theme.typography.body, styles.label, { color: theme.textPrimary }]}
                  numberOfLines={1}
                >
                  {item.display_name}
                </Text>
              )}
            </PressableScale>
          </GlassInputBar>
        </View>
      ))}
    </View>
  );
}
