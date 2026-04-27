import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '../../design/ThemeContext';
import { useReduceMotion } from '../../ui/motion/useReduceMotion';
import { checkStatePreset } from '../../ui/motion/lists';
import { useHaptics } from '../../hooks/useHaptics';
import { toBoolean } from '../../utils/normalize';
import { getRowSecondarySegments } from '../../utils/rowSecondaryLine';
import type { ListItem } from '../../types/models';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';
import { markRender } from '../../utils/perf';

const MIN_TOUCH_TARGET = 44;

type ListItemRowProps = {
  item: ListItem;
  onToggle: (id: string, is_checked: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (item: ListItem) => void;
  /** When true, hide the inline edit icon (edit still available via row tap and swipe). Used in Shop and Plan modes. */
  hideEditIcon?: boolean;
  /** When true, Plan mode: no checkbox, leading icon, row tap = edit. */
  isPlanMode?: boolean;
  /** Compact meal label for the row chip (e.g. "Sun · dinner") */
  linkedMealLabel?: string;
  /** Full meal phrase for VoiceOver (e.g. "Sunday dinner") */
  linkedMealAccessibilityLabel?: string;
};

function ListItemRowInner({
  item,
  onToggle,
  onDelete,
  onEdit,
  hideEditIcon = false,
  isPlanMode = false,
  linkedMealLabel,
  linkedMealAccessibilityLabel,
}: ListItemRowProps) {
  if (__DEV__) markRender('ListItemRow');
  const theme = useTheme();
  const haptics = useHaptics();
  const reduceMotion = useReduceMotion();
  const checked = toBoolean(item.is_checked);
  const checkProgress = useSharedValue(checked ? 1 : 0);

  useEffect(() => {
    checkProgress.value = withTiming(checked ? 1 : 0, checkStatePreset(reduceMotion));
  }, [checked, checkProgress, reduceMotion]);

  const leadingAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.94 + 0.06 * checkProgress.value }],
    opacity: 0.75 + 0.25 * checkProgress.value,
  }));

  const handleToggle = () => {
    haptics.light();
    onToggle(item.id, !checked);
  };

  const handleSwipeDeletePress = () => {
    haptics.light();
    onDelete(item.id);
  };

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

  const handleEdit = () => {
    haptics.light();
    onEdit(item);
  };

  const handleRowPress = isPlanMode ? undefined : handleToggle;

  return (
    <View style={styles.swipeableWrapper}>
      <ReanimatedSwipeable
        renderRightActions={renderRightActions}
        friction={2}
        overshootRight={false}
      >
        <Pressable
          style={[styles.row, { backgroundColor: theme.surface }]}
          onPress={handleRowPress}
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
            <Text
              style={[
                theme.typography.body,
                styles.itemTitle,
                { color: theme.textPrimary },
                !isPlanMode && checked ? styles.checkedText : undefined,
              ]}
              numberOfLines={2}
            >
              {item.name}
            </Text>
            {secondarySegments.length > 0 ? (
              <View
                style={[styles.secondaryPillsRow, !isPlanMode && checked ? styles.secondaryPillsChecked : undefined]}
                accessible
                accessibilityRole="text"
                accessibilityLabel={secondaryA11y}
              >
                {secondarySegments.map((segment, index) =>
                  segment.kind === 'meal' ? (
                    <View
                      key={index}
                      style={[styles.metaPill, styles.mealMetaPill, { backgroundColor: theme.accent + '18' }]}
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                    >
                      <Ionicons name="restaurant-outline" size={13} color={theme.accent} style={styles.mealMetaIcon} />
                      <Text
                        style={[theme.typography.caption1, { color: theme.textPrimary }]}
                        numberOfLines={1}
                      >
                        {segment.text}
                      </Text>
                    </View>
                  ) : (
                    <View
                      key={index}
                      style={[styles.metaPill, { backgroundColor: theme.textSecondary + '16' }]}
                    >
                      <Text
                        style={[theme.typography.caption1, { color: theme.textPrimary }]}
                        numberOfLines={1}
                      >
                        {segment.text}
                      </Text>
                    </View>
                  )
                )}
              </View>
            ) : null}
          </View>
        </View>
        {!hideEditIcon && !isPlanMode && (
          <TouchableOpacity
            onPress={handleEdit}
            style={[styles.editBtn, { backgroundColor: theme.surface }]}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="pencil-outline" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        )}
      </Pressable>
    </ReanimatedSwipeable>
    </View>
  );
}

export const ListItemRow = React.memo(ListItemRowInner);

const styles = StyleSheet.create({
  swipeableWrapper: {
    overflow: 'hidden' as const,
  },
  row: {
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
  secondaryPillsChecked: {
    opacity: 0.6,
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
    opacity: 0.6,
  },
  swipeActionsOuter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: spacing.sm,
    gap: spacing.sm,
    minWidth: MIN_TOUCH_TARGET * 2 + spacing.sm + spacing.sm,
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
