import React, { useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withRepeat,
  withSequence,
  cancelAnimation,
} from 'react-native-reanimated';
import { useTheme } from '../../design/ThemeContext';
import { ZONE_LABELS } from '../../data/zone';
import { getZoneDisplayIcon } from '../../utils/storeUtils';
import { ListItemRow } from './ListItemRow';
import { ListSection } from '../ui/ListSection';
import type { ListItem, ZoneKey } from '../../types/models';
import { linkedMealRowMetaFromIds, type LinkedMealRowMeta } from '../../utils/mealLabel';
import type { ZoneIconOverrides } from '../../utils/storeUtils';
import { listDuration } from '../../ui/motion/lists';
import { spacing } from '../../design/spacing';
import { markRender } from '../../utils/perf';

type ZoneSectionProps = {
  zoneKey: ZoneKey;
  items: ListItem[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onToggleItem: (id: string, is_checked: boolean) => void;
  onDeleteItem: (id: string) => void;
  onEditItem: (item: ListItem) => void;
  /** Clear all items in this section (caller shows confirmation). */
  onRequestDeleteZone?: (zoneKey: ZoneKey) => void;
  /** When set to this zone, header long-press mode is active: wiggle + delete control. */
  zoneClearMode?: ZoneKey | null;
  /** Enter section clear mode (long-press on header). */
  onEnterZoneClearMode?: () => void;
  /** Exit clear mode (scroll, tap outside, or another section header). */
  onExitZoneClearMode?: () => void;
  /** Shopping mode: highlight current section */
  isCurrent?: boolean;
  /** When true, show "X left" (Shop mode). When false, show neutral count like "2 items" (Plan mode). */
  isShopMode?: boolean;
  /** Shop mode only: remaining unchecked count in this section */
  remaining?: number;
  /** When true, hide edit icon on rows (edit via swipe only) */
  hideEditIcon?: boolean;
  /** Map of mealId -> compact display + full accessibility label for list row meal chip */
  linkedMealLabels?: Map<string, LinkedMealRowMeta>;
  /** Custom emoji overrides per section (from store) */
  zoneIconOverrides?: ZoneIconOverrides | null;
  /** When true, skip layout animation on expand/collapse */
  reduceMotion?: boolean;
};

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const WIGGLE_STEP_MS = 120;
const WIGGLE_DEG = 1.4;

function ZoneSectionInner({
  zoneKey,
  items,
  collapsed,
  onToggleCollapsed,
  onToggleItem,
  onDeleteItem,
  onEditItem,
  onRequestDeleteZone,
  zoneClearMode = null,
  onEnterZoneClearMode,
  onExitZoneClearMode,
  isCurrent = false,
  isShopMode = false,
  remaining = 0,
  hideEditIcon = false,
  linkedMealLabels,
  zoneIconOverrides,
  reduceMotion = false,
}: ZoneSectionProps) {
  if (__DEV__) markRender('ZoneSection');
  const theme = useTheme();
  const label = ZONE_LABELS[zoneKey];
  const iconResult = getZoneDisplayIcon(zoneKey, zoneIconOverrides);
  const chevronRot = useSharedValue(collapsed ? 0 : 1);
  const wiggleRot = useSharedValue(0);

  const isClearActive = zoneClearMode === zoneKey;

  useEffect(() => {
    chevronRot.value = withTiming(collapsed ? 0 : 1, {
      duration: reduceMotion ? Math.min(listDuration.micro, listDuration.expandCollapse) : listDuration.expandCollapse,
    });
  }, [collapsed, chevronRot, reduceMotion]);

  useEffect(() => {
    if (!isClearActive || reduceMotion) {
      cancelAnimation(wiggleRot);
      wiggleRot.value = withTiming(0, { duration: listDuration.micro });
      return;
    }
    wiggleRot.value = withRepeat(
      withSequence(
        withTiming(-WIGGLE_DEG, { duration: WIGGLE_STEP_MS }),
        withTiming(WIGGLE_DEG, { duration: WIGGLE_STEP_MS })
      ),
      -1,
      true
    );
    return () => {
      cancelAnimation(wiggleRot);
    };
  }, [isClearActive, reduceMotion, wiggleRot]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRot.value * 180}deg` }],
  }));

  const wiggleStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${wiggleRot.value}deg` }],
  }));

  if (items.length === 0) return null;

  const handleHeaderPress = () => {
    if (zoneClearMode != null) {
      onExitZoneClearMode?.();
    }
    if (!reduceMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    onToggleCollapsed();
  };

  const shopCurrentChrome =
    isCurrent && isShopMode
      ? {
          backgroundColor: theme.accent + '15',
          paddingHorizontal: theme.spacing.sm,
          marginHorizontal: -theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          borderRadius: theme.radius.sm,
          borderLeftWidth: 3,
          borderRightWidth: 3,
          borderLeftColor: theme.accent,
          borderRightColor: theme.accent,
        }
      : null;

  const headerStyle = [styles.header, styles.headerTapInner];

  return (
    <Animated.View
      style={[styles.sectionOuter, wiggleStyle]}
      onAccessibilityEscape={isClearActive ? onExitZoneClearMode : undefined}
    >
      <ListSection glass={false} dense style={styles.section}>
        <View style={[styles.headerRow, shopCurrentChrome]}>
          <Pressable
            style={[headerStyle, styles.headerTap]}
            onPress={handleHeaderPress}
            onLongPress={onRequestDeleteZone && onEnterZoneClearMode ? onEnterZoneClearMode : undefined}
            delayLongPress={450}
            accessibilityRole="button"
            accessibilityLabel={`${label} section`}
            accessibilityHint={
              onRequestDeleteZone && onEnterZoneClearMode
                ? 'Tap to expand or collapse. Long press to remove all items in this section. Scroll or use the escape gesture to leave clear mode.'
                : undefined
            }
            accessibilityActions={
              onRequestDeleteZone
                ? [{ name: 'clearSection', label: 'Clear section' }]
                : undefined
            }
            onAccessibilityAction={(e) => {
              if (e.nativeEvent.actionName === 'clearSection' && onRequestDeleteZone) {
                onRequestDeleteZone(zoneKey);
              }
            }}
          >
            <View style={styles.headerLeft}>
              {iconResult.type === 'emoji' ? (
                <Text style={[styles.zoneEmoji, styles.zoneIcon]}>{iconResult.value}</Text>
              ) : (
                <Ionicons
                  name={
                    (typeof iconResult.value === 'string' ? iconResult.value : 'ellipsis-horizontal') as keyof typeof Ionicons.glyphMap
                  }
                  size={18}
                  color={isCurrent ? theme.accent : theme.textSecondary}
                  style={styles.zoneIcon}
                />
              )}
              <Text
                style={[
                  theme.typography.caption1,
                  {
                    color: isCurrent ? theme.textPrimary : theme.textSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  },
                ]}
              >
                {label}
              </Text>
              {isShopMode && remaining > 0 && (
                <Text
                  style={[
                    theme.typography.footnote,
                    { color: theme.textSecondary, marginLeft: theme.spacing.xs },
                  ]}
                >
                  · {remaining} left
                </Text>
              )}
            </View>
            <View style={styles.headerRight}>
              {isShopMode && remaining > 0 ? (
                <Text style={[theme.typography.footnote, { color: theme.textSecondary }]}>
                  {remaining} left
                </Text>
              ) : (
                <Text style={[theme.typography.footnote, { color: theme.textSecondary }]}>
                  {items.length}
                  {!isShopMode ? ` ${items.length === 1 ? 'item' : 'items'}` : ''}
                </Text>
              )}
              <Animated.View style={[styles.chevronWrap, chevronStyle]}>
                <Ionicons name="chevron-down" size={16} color={theme.textSecondary} />
              </Animated.View>
            </View>
          </Pressable>
          {isClearActive && onRequestDeleteZone ? (
            <Pressable
              style={styles.zoneDeleteBtn}
              onPress={() => onRequestDeleteZone(zoneKey)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${label} section`}
            >
              <Ionicons name="trash-outline" size={20} color={theme.danger} />
            </Pressable>
          ) : null}
        </View>
        {!collapsed
          ? items.map((item, index) => {
              const mealMeta =
                linkedMealLabels &&
                linkedMealLabels.size > 0 &&
                item.linked_meal_ids &&
                item.linked_meal_ids.length > 0
                  ? linkedMealRowMetaFromIds(item, linkedMealLabels)
                  : null;
              return (
                <React.Fragment key={item.id}>
                  {index > 0 && (
                    <View style={[styles.rowDivider, { backgroundColor: theme.divider }]} />
                  )}
                  <ListItemRow
                    item={item}
                    onToggle={onToggleItem}
                    onDelete={onDeleteItem}
                    onEdit={onEditItem}
                    hideEditIcon={hideEditIcon}
                    isPlanMode={!isShopMode}
                    linkedMealLabel={mealMeta?.display}
                    linkedMealAccessibilityLabel={mealMeta?.accessibilityLabel}
                  />
                </React.Fragment>
              );
            })
          : null}
      </ListSection>
    </Animated.View>
  );
}

export const ZoneSection = React.memo(ZoneSectionInner);

const styles = StyleSheet.create({
  sectionOuter: {
    marginBottom: 0,
  },
  section: {
    marginBottom: spacing.lg,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xxs,
  },
  headerTap: {
    flex: 1,
    minWidth: 0,
  },
  headerTapInner: {
    paddingVertical: spacing.xs,
    paddingHorizontal: 0,
    marginBottom: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  zoneDeleteBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  zoneIcon: {
    marginRight: spacing.sm,
  },
  zoneEmoji: {
    fontSize: 18,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  chevronWrap: {
    marginLeft: spacing.xxs,
  },
});
