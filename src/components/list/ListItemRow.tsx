import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { TouchableOpacity as GHTouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '../../design/ThemeContext';
import { useReduceMotion } from '../../ui/motion/useReduceMotion';
import {
  checkStatePreset,
  itemLayoutTransition,
  rowInsertPreset,
  rowRemovePreset,
} from '../../ui/motion/lists';
import { useHaptics } from '../../hooks/useHaptics';
import { toBoolean } from '../../utils/normalize';
import { getRowSecondarySegments } from '../../utils/rowSecondaryLine';
import type { ListItem } from '../../types/models';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';
import { markRender } from '../../utils/perf';
import { isPendingListItemId } from '../../utils/listItemPending';

const MIN_TOUCH_TARGET = 44;
const AnimatedText = Animated.createAnimatedComponent(Text);

type ListItemRowProps = {
  item: ListItem;
  onToggle: (id: string, is_checked: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (item: ListItem) => void;
  /** When true, hide the inline edit icon (edit still available via row tap and swipe). Used in Shop and Plan modes. */
  hideEditIcon?: boolean;
  /** When true, Plan mode: no checkbox, leading icon, row tap = edit. */
  isPlanMode?: boolean;
  /** Shop mode: swipe right to reveal check action. */
  swipeToCheck?: boolean;
  /** Compact meal label for the row chip (e.g. "Sun · dinner") */
  linkedMealLabel?: string;
  /** Full meal phrase for VoiceOver (e.g. "Sunday dinner") */
  linkedMealAccessibilityLabel?: string;
  /** When provided, tapping the quantity chip opens inline quantity editing. */
  onTapQuantity?: (item: ListItem) => void;
};

function ListItemRowInner({
  item,
  onToggle,
  onDelete,
  onEdit,
  hideEditIcon = false,
  isPlanMode = false,
  swipeToCheck = false,
  linkedMealLabel,
  linkedMealAccessibilityLabel,
  onTapQuantity,
}: ListItemRowProps) {
  if (__DEV__) markRender('ListItemRow');
  const theme = useTheme();
  const haptics = useHaptics();
  const reduceMotion = useReduceMotion();
  const checked = toBoolean(item.is_checked);
  const checkProgress = useSharedValue(checked ? 1 : 0);
  const rowPending = isPendingListItemId(item.id);
  const pendingOpacity = useSharedValue(rowPending ? 0.62 : 1);

  useEffect(() => {
    checkProgress.value = withTiming(checked ? 1 : 0, checkStatePreset(reduceMotion));
  }, [checked, checkProgress, reduceMotion]);

  useEffect(() => {
    pendingOpacity.value = withTiming(rowPending ? 0.62 : 1, checkStatePreset(reduceMotion));
  }, [rowPending, pendingOpacity, reduceMotion]);

  const rowAnimStyle = useAnimatedStyle(() => ({
    opacity: pendingOpacity.value,
  }));

  const leadingAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.88 + 0.12 * checkProgress.value }],
    opacity: 0.7 + 0.3 * checkProgress.value,
  }));

  const titleAnimStyle = useAnimatedStyle(() => ({
    opacity: 1 - 0.4 * checkProgress.value,
  }));

  const secondaryAnimStyle = useAnimatedStyle(() => ({
    opacity: 1 - 0.4 * checkProgress.value,
  }));

  const handleToggle = () => {
    if (!checked) {
      haptics.success();
    } else {
      haptics.light();
    }
    onToggle(item.id, !checked);
  };

  const handleSwipeDeletePress = () => {
    haptics.light();
    onDelete(item.id);
  };

  const renderLeftActions =
    swipeToCheck && !isPlanMode && !checked && !rowPending
      ? () => (
          <View style={styles.swipeActionsOuterLeft}>
            <TouchableOpacity
              style={[styles.swipeActionCircle, { backgroundColor: theme.accent + '25' }]}
              onPress={handleToggle}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Check off ${item.name}`}
            >
              <Ionicons name="checkmark" size={20} color={theme.accent} />
            </TouchableOpacity>
          </View>
        )
      : undefined;

  const renderRightActions = () => (
    <View style={styles.swipeActionsOuter}>
      <TouchableOpacity
        style={[styles.swipeActionCircle, { backgroundColor: theme.textSecondary + '20' }]}
        onPress={() => {
          haptics.light();
          onEdit(item);
        }}
        activeOpacity={0.7}
      >
        <Ionicons name="pencil-outline" size={20} color={theme.textPrimary} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.swipeActionDelete, { backgroundColor: theme.danger + '25' }]}
        onPress={handleSwipeDeletePress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Delete item"
      >
        <Ionicons name="trash-outline" size={20} color={theme.danger} />
      </TouchableOpacity>
    </View>
  );

  const secondarySegments = getRowSecondarySegments(item, linkedMealLabel, linkedMealAccessibilityLabel);

  const secondaryA11y = secondarySegments
    .map((s) => (s.kind === 'meal' ? s.accessibilityLabel : s.text))
    .join(', ');

  const showHighPriorityBadge = item.priority === 'high' && !checked;

  const handleEdit = () => {
    haptics.light();
    onEdit(item);
  };

  const handleRowPress = isPlanMode ? handleEdit : handleToggle;

  return (
    <Animated.View
      entering={reduceMotion ? undefined : rowInsertPreset(reduceMotion)}
      exiting={reduceMotion ? undefined : rowRemovePreset(reduceMotion)}
      layout={reduceMotion ? undefined : itemLayoutTransition}
      style={styles.swipeableWrapper}
    >
      <ReanimatedSwipeable
        enabled={!rowPending}
        renderLeftActions={renderLeftActions}
        renderRightActions={rowPending ? undefined : renderRightActions}
        friction={2}
        overshootLeft={false}
        overshootRight={false}
      >
        <Animated.View style={rowAnimStyle}>
          {/* Swipe-to-check hint: thin bar on left edge; red for high-priority, accent otherwise */}
          {swipeToCheck && !checked && !rowPending ? (
            <Animated.View
              style={[
                styles.swipeHint,
                { backgroundColor: item.priority === 'high' ? theme.danger : theme.accent },
                leadingAnimStyle,
              ]}
            />
          ) : null}
          <Pressable
            style={styles.row}
            onPress={rowPending ? undefined : handleRowPress}
            disabled={rowPending}
            accessibilityState={rowPending ? { disabled: true } : undefined}
            accessibilityLabel={rowPending ? `${item.name}, saving to your list` : undefined}
          >
            <View style={styles.toggleArea}>
              {!isPlanMode && (
                <Animated.View style={[styles.leadingWrapper, leadingAnimStyle]}>
                  <Ionicons
                    name={checked ? 'checkmark-circle' : 'ellipse-outline'}
                    size={24}
                    color={checked ? theme.accent : theme.textSecondary}
                  />
                </Animated.View>
              )}
              <View style={styles.textBlock}>
                <AnimatedText
                  style={[
                    theme.typography.body,
                    styles.itemTitle,
                    { color: theme.textPrimary },
                    titleAnimStyle,
                    !isPlanMode && checked ? styles.checkedText : undefined,
                  ]}
                  numberOfLines={2}
                >
                  {item.name}
                </AnimatedText>
                {(showHighPriorityBadge || secondarySegments.length > 0) ? (
                  <Animated.View
                    style={[styles.secondaryPillsRow, secondaryAnimStyle]}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  >
                    {showHighPriorityBadge && (
                      <View
                        style={[styles.metaPill, styles.priorityHighPill, { backgroundColor: theme.danger + '18' }]}
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                      >
                        <Ionicons name="alert-circle-outline" size={13} color={theme.danger} style={styles.priorityHighIcon} />
                        <Text style={[theme.typography.caption1, styles.priorityHighText, { color: theme.danger }]}>
                          High
                        </Text>
                      </View>
                    )}
                    {secondarySegments.map((segment, index) => {
                      const isQtyPill =
                        index === 0 &&
                        segment.kind === 'text' &&
                        item.quantity_value != null &&
                        item.quantity_unit != null;
                      if (segment.kind === 'meal') {
                        return (
                          <View
                            key={index}
                            style={[styles.metaPill, styles.mealMetaPill, { backgroundColor: theme.accent + '18' }]}
                            accessibilityElementsHidden
                            importantForAccessibility="no-hide-descendants"
                          >
                            <Ionicons name="restaurant-outline" size={13} color={theme.accent} style={styles.mealMetaIcon} />
                            <Text style={[theme.typography.caption1, { color: theme.textPrimary }]} numberOfLines={1}>
                              {segment.text}
                            </Text>
                          </View>
                        );
                      }
                      if (isQtyPill && onTapQuantity) {
                        return (
                          <Pressable
                            key={index}
                            onPress={() => onTapQuantity(item)}
                            style={[styles.metaPill, styles.qtyPill, { backgroundColor: theme.accent + '18' }]}
                            accessibilityRole="button"
                            accessibilityLabel={`Edit quantity of ${item.name}, ${segment.text}`}
                          >
                            <Ionicons name="create-outline" size={12} color={theme.accent} style={styles.qtyEditIcon} />
                            <Text style={[theme.typography.caption1, styles.qtyPillText, { color: theme.textPrimary }]} numberOfLines={1}>
                              {segment.text}
                            </Text>
                          </Pressable>
                        );
                      }
                      return (
                        <View key={index} style={[styles.metaPill, { backgroundColor: theme.textSecondary + '16' }]}>
                          <Text style={[theme.typography.caption1, { color: theme.textPrimary }]} numberOfLines={1}>
                            {segment.text}
                          </Text>
                        </View>
                      );
                    })}
                  </Animated.View>
                ) : null}
              </View>
            </View>
            {!hideEditIcon && !isPlanMode && (
              <TouchableOpacity
                onPress={handleEdit}
                disabled={rowPending}
                style={styles.editBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="pencil-outline" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            )}
          </Pressable>
        </Animated.View>
      </ReanimatedSwipeable>
    </Animated.View>
  );
}

export const ListItemRow = React.memo(ListItemRowInner);

const styles = StyleSheet.create({
  swipeableWrapper: {
    overflow: 'hidden' as const,
  },
  swipeHint: {
    position: 'absolute',
    left: 0,
    top: 6,
    bottom: 6,
    width: 3,
    borderRadius: 2,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: 0,
  },
  toggleArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'flex-start',
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  itemTitle: {
    textTransform: 'capitalize',
  },
  leadingWrapper: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  secondaryPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xxs,
  },
  metaPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.full,
    maxWidth: '100%',
  },
  mealMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    maxWidth: '100%',
  },
  mealMetaIcon: {
    flexShrink: 0,
  },
  priorityHighPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  priorityHighIcon: {
    flexShrink: 0,
  },
  priorityHighText: {
    fontWeight: '500',
  },
  qtyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  qtyEditIcon: {
    flexShrink: 0,
  },
  qtyPillText: {},
  editBtn: {
    marginLeft: spacing.xs,
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: MIN_TOUCH_TARGET / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkedText: {
    textDecorationLine: 'line-through',
  },
  swipeActionsOuter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: spacing.sm,
    gap: spacing.sm,
    minWidth: MIN_TOUCH_TARGET * 2 + spacing.sm + spacing.sm,
  },
  swipeActionsOuterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingLeft: spacing.sm,
    minWidth: MIN_TOUCH_TARGET + spacing.sm + spacing.sm,
  },
  swipeActionCircle: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: MIN_TOUCH_TARGET / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeActionDelete: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: MIN_TOUCH_TARGET / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
