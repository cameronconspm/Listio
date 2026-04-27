import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/ThemeContext';
import { horizontalScrollInsetBleed } from '../../design/layout';
import { ZONE_LABELS, ZONE_ICONS } from '../../data/zone';
import { useHaptics } from '../../hooks/useHaptics';
import type { ZoneKey } from '../../types/models';

type ListStatsHeaderProps = {
  totalItems: number;
  zoneCounts: Record<ZoneKey, number>;
  zoneRemaining?: Partial<Record<ZoneKey, number>>;
  /** Hide stat pills when using ListSummaryStrip for mode-aware stats */
  hideStatPills?: boolean;
  /** Deemphasize section chips (display-only, not tappable). Reduces visual prominence. */
  zoneChipsDeemphasized?: boolean;
  /** Section filter for list; when set, chips become tappable. */
  filterZone?: ZoneKey | 'all';
  onFilterChange?: (zone: ZoneKey | 'all') => void;
  isShopMode?: boolean;
};

function useListStatsStyles() {
  const theme = useTheme();
  return useMemo(
    () =>
      StyleSheet.create({
        container: {
          paddingBottom: theme.spacing.xs,
          gap: theme.spacing.sm,
        },
        /** Tighter stack when zone chips sit directly above `ListSummaryStrip` (no stat row). */
        containerTightBelowChips: {
          paddingBottom: 0,
          gap: 0,
        },
        statRow: {
          flexDirection: 'row',
          gap: theme.spacing.sm,
        },
        statPill: {
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.md,
          minWidth: 80,
        },
        statPillIconWrap: {
          width: 32,
          height: 32,
          borderRadius: 16,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: theme.spacing.xs,
        },
        zoneChipsWrap: {
          flexDirection: 'row',
          gap: theme.spacing.sm,
          paddingTop: theme.spacing.xs,
        },
        zoneChipsContentInset: {
          paddingHorizontal: theme.spacing.md,
        },
        zoneChip: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: theme.spacing.xs,
          paddingLeft: theme.spacing.sm,
          paddingRight: theme.spacing.xs,
          borderRadius: 9999,
        },
        zoneChipIcon: {
          marginRight: theme.spacing.xs,
        },
        zoneBadge: {
          marginLeft: theme.spacing.xs,
          paddingHorizontal: theme.spacing.xs,
          paddingVertical: 2,
          borderRadius: theme.radius.sm,
          minWidth: 20,
          alignItems: 'center',
        },
      }),
    [theme],
  );
}

/** Lively stat pill with icon and value */
function StatPill({
  icon,
  value,
  label,
  accent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string | number;
  label: string;
  accent?: boolean;
}) {
  const theme = useTheme();
  const styles = useListStatsStyles();
  const tint = accent ? theme.accent : theme.textSecondary;

  return (
    <View style={[styles.statPill, { backgroundColor: tint + '15' }]}>
      <View style={[styles.statPillIconWrap, { backgroundColor: tint + '25' }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <Text style={[theme.typography.title3, { color: theme.textPrimary }]}>{value}</Text>
      <Text style={[theme.typography.caption2, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

/** Section chip with icon and count; tappable when onPress provided */
function ZoneChip({
  zone,
  count,
  selected,
  onPress,
}: {
  zone: ZoneKey;
  count: number;
  selected?: boolean;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const haptics = useHaptics();
  const styles = useListStatsStyles();
  const icon = ZONE_ICONS[zone] as keyof typeof Ionicons.glyphMap;
  const label = ZONE_LABELS[zone];
  const chipBg = selected ? theme.accent + '25' : theme.divider + '30';
  const iconColor = selected ? theme.accent : theme.textSecondary;
  const badgeBg = selected ? theme.accent : theme.textSecondary + '50';
  const content = (
    <>
      <Ionicons name={icon} size={14} color={iconColor} style={styles.zoneChipIcon} />
      <Text style={[theme.typography.footnote, { color: selected ? theme.textPrimary : theme.textSecondary }]}>{label}</Text>
      <View style={[styles.zoneBadge, { backgroundColor: badgeBg }]}>
        <Text
          style={[
            theme.typography.caption2,
            { color: selected ? theme.onAccent : theme.textSecondary },
          ]}
        >
          {count}
        </Text>
      </View>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        style={[styles.zoneChip, { backgroundColor: chipBg, borderWidth: 1, borderColor: selected ? theme.accent + '60' : 'transparent' }]}
        onPress={() => {
          haptics.light();
          onPress();
        }}
        activeOpacity={0.7}
      >
        {content}
      </TouchableOpacity>
    );
  }
  return <View style={[styles.zoneChip, { backgroundColor: chipBg }]}>{content}</View>;
}

/** "All" filter chip */
function AllChip({ selected, totalItems, onPress }: { selected: boolean; totalItems: number; onPress?: () => void }) {
  const theme = useTheme();
  const haptics = useHaptics();
  const styles = useListStatsStyles();
  const chipBg = selected ? theme.accent + '25' : theme.divider + '30';
  const content = (
    <>
      <Text style={[theme.typography.footnote, { color: selected ? theme.textPrimary : theme.textSecondary }]}>All</Text>
      <View style={[styles.zoneBadge, { backgroundColor: selected ? theme.accent : theme.textSecondary + '50' }]}>
        <Text style={[theme.typography.caption2, { color: selected ? theme.onAccent : theme.textSecondary }]}>{totalItems}</Text>
      </View>
    </>
  );
  if (onPress) {
    return (
      <TouchableOpacity
        style={[styles.zoneChip, { backgroundColor: chipBg, borderWidth: 1, borderColor: selected ? theme.accent + '60' : 'transparent' }]}
        onPress={() => {
          haptics.light();
          onPress();
        }}
        activeOpacity={0.7}
      >
        {content}
      </TouchableOpacity>
    );
  }
  return <View style={[styles.zoneChip, { backgroundColor: chipBg }]}>{content}</View>;
}

export function ListStatsHeader({
  totalItems,
  zoneCounts,
  zoneRemaining,
  hideStatPills = false,
  zoneChipsDeemphasized = false,
  filterZone = 'all',
  onFilterChange,
  isShopMode = false,
}: ListStatsHeaderProps) {
  const theme = useTheme();
  const styles = useListStatsStyles();
  const populatedZones = (Object.entries(zoneCounts ?? {}) as [ZoneKey, number][]).filter(
    ([_, count]) => count > 0
  );
  const hasFilterSupport = !!onFilterChange && !zoneChipsDeemphasized;

  if (totalItems === 0 && populatedZones.length === 0) return null;

  return (
    <View style={[styles.container, hideStatPills && styles.containerTightBelowChips]}>
      {!hideStatPills && (totalItems > 0 || populatedZones.length > 0) && (
        <View style={styles.statRow}>
          {totalItems > 0 && (
            <StatPill
              icon="bag-handle"
              value={totalItems}
              label={totalItems === 1 ? 'item' : 'items'}
              accent
            />
          )}
          {populatedZones.length > 0 && (
            <StatPill
              icon="grid"
              value={populatedZones.length}
              label={populatedZones.length === 1 ? 'section' : 'sections'}
            />
          )}
        </View>
      )}

      {populatedZones.length > 0 && (
        <View style={horizontalScrollInsetBleed(theme.spacing.md)}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              styles.zoneChipsWrap,
              styles.zoneChipsContentInset,
              { paddingBottom: hideStatPills ? 0 : theme.spacing.xs },
            ]}
          >
            {hasFilterSupport && onFilterChange ? (
              <AllChip
                selected={filterZone === 'all'}
                totalItems={totalItems}
                onPress={() => {
                  onFilterChange('all');
                }}
              />
            ) : null}
            {populatedZones.map(([zone, totalCount]) => {
              const count = isShopMode ? ((zoneRemaining ?? {})[zone] ?? 0) : totalCount;
              return (
                <ZoneChip
                  key={zone}
                  zone={zone}
                  count={count}
                  selected={hasFilterSupport && filterZone === zone}
                  onPress={hasFilterSupport && onFilterChange ? () => onFilterChange(zone) : undefined}
                />
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
