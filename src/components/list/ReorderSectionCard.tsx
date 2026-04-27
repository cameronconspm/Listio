import React, { type ComponentProps } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/ThemeContext';
import { ZONE_LABELS } from '../../data/zone';
import { getZoneDisplayIcon } from '../../utils/storeUtils';
import type { ListItem, ZoneKey } from '../../types/models';
import type { ZoneIconOverrides } from '../../utils/storeUtils';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';

type ReorderSectionCardProps = {
  zoneKey: ZoneKey;
  items: ListItem[];
  remaining?: number;
  isShopMode?: boolean;
  /** When true, render content only (no card wrapper) for embedding in a parent card. */
  embedded?: boolean;
  /** Custom emoji overrides per section (from store) */
  zoneIconOverrides?: ZoneIconOverrides | null;
};

/** Compact summary card for reorder mode. Shows section icon, name, count—no item rows. */
export function ReorderSectionCard({
  zoneKey,
  items,
  remaining = 0,
  isShopMode = false,
  embedded = false,
  zoneIconOverrides,
}: ReorderSectionCardProps) {
  const theme = useTheme();
  const label = ZONE_LABELS[zoneKey];
  const iconResult = getZoneDisplayIcon(zoneKey, zoneIconOverrides);
  const count = items.length;

  const content = (
    <View style={styles.content}>
      <View style={[styles.iconWrap, { backgroundColor: theme.textSecondary + '15' }]}>
        {iconResult.type === 'emoji' ? (
          <Text style={styles.emojiIcon}>{iconResult.value}</Text>
        ) : (
          <Ionicons
            name={iconResult.value as ComponentProps<typeof Ionicons>['name']}
            size={20}
            color={theme.textSecondary}
          />
        )}
      </View>
      <View style={styles.textBlock}>
        <Text
          style={[theme.typography.subhead, { color: theme.textPrimary, fontWeight: '500' }]}
          numberOfLines={1}
        >
          {label}
        </Text>
        <Text style={[theme.typography.footnote, { color: theme.textSecondary }]}>
          {isShopMode && remaining > 0
            ? `${remaining} left · ${count} ${count === 1 ? 'item' : 'items'}`
            : `${count} ${count === 1 ? 'item' : 'items'}`}
        </Text>
      </View>
    </View>
  );

  if (embedded) return content;
  return <View style={[styles.card, { backgroundColor: theme.surface, ...theme.shadows.card }]}>{content}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  emojiIcon: {
    fontSize: 20,
  },
});
