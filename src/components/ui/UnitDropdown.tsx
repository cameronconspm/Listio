import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/ThemeContext';
import { UNITS, type Unit } from '../../data/units';
import { useHaptics } from '../../hooks/useHaptics';
import { AnchoredMenu } from './AnchoredMenu';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';
import { UnitSelectionList } from './UnitSelectionList';
import { normalizeUnitValue } from './unitSelection';

const MENU_MAX_HEIGHT = 220;
const ROW_HEIGHT = 56;
const MENU_MIN_WIDTH = 160;
const MENU_GAP = 4;
/** Require this much clearance beyond the menu to open on that side. */
const EDGE_MARGIN = 32;

type UnitDropdownProps = {
  value: string;
  onSelect: (unit: Unit) => void;
  /** Optional container style for the trigger (e.g. when embedded in a row) */
  containerStyle?: ViewStyle;
  /** Optional style override for the trigger field */
  triggerStyle?: ViewStyle;
  /** Called when the user opens the unit menu (e.g. to expand a parent sheet). */
  onOpenRequest?: () => void;
  /**
   * When true, prefer opening above the trigger when there is room (e.g. Add Item bottom sheet)
   * so the menu does not cover fields directly below the Qty row.
   */
  preferOpenAbove?: boolean;
  /** Accessibility label for the trigger control. */
  accessibilityLabel?: string;
};

function computeMenuLayout(
  x: number,
  y: number,
  width: number,
  height: number,
  screenWidth: number,
  screenHeight: number,
  safeTop: number,
  safeBottom: number,
  preferOpenAbove: boolean
): { x: number; y: number; width: number } {
  const menuHeight = Math.min(MENU_MAX_HEIGHT, UNITS.length * ROW_HEIGHT);
  const spaceBelow = screenHeight - safeBottom - (y + height);
  const spaceAbove = y - safeTop;

  let useBelow: boolean;
  if (preferOpenAbove) {
    if (spaceAbove >= menuHeight + EDGE_MARGIN) {
      useBelow = false;
    } else if (spaceBelow >= menuHeight + EDGE_MARGIN) {
      useBelow = true;
    } else {
      useBelow = spaceBelow >= spaceAbove;
    }
  } else if (spaceBelow >= menuHeight + EDGE_MARGIN) {
    useBelow = true;
  } else {
    useBelow = false;
  }

  let menuY = useBelow ? y + height + MENU_GAP : y - menuHeight - MENU_GAP;
  if (useBelow) {
    menuY = Math.min(menuY, screenHeight - safeBottom - menuHeight - 8);
  } else {
    menuY = Math.max(safeTop + 8, menuY);
  }

  const menuX = Math.max(
    spacing.md,
    Math.min(x, screenWidth - MENU_MIN_WIDTH - spacing.md)
  );
  const menuW = Math.max(MENU_MIN_WIDTH, width);

  return { x: menuX, y: menuY, width: menuW };
}

/**
 * Apple UIMenu-style inline unit dropdown. Appears near the field, scrollable list, no full modal.
 * For UI inside another RN `Modal` bottom sheet, do not stack a second `Modal` (e.g. {@link UnitPickerSheet}) — use an in-sheet overlay instead (see QuickAddComposer).
 */
export function UnitDropdown({
  value,
  onSelect,
  containerStyle,
  triggerStyle,
  onOpenRequest,
  preferOpenAbove = false,
  accessibilityLabel = 'Change unit',
}: UnitDropdownProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const triggerRef = useRef<View>(null);
  const [visible, setVisible] = useState(false);
  const [menuLayout, setMenuLayout] = useState<{ x: number; y: number; width: number } | null>(null);

  const currentUnit = normalizeUnitValue(value);

  const open = () => {
    onOpenRequest?.();
    triggerRef.current?.measureInWindow((mx, my, mwidth, mheight) => {
      const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
      setMenuLayout(
        computeMenuLayout(
          mx,
          my,
          mwidth,
          mheight,
          screenWidth,
          screenHeight,
          insets.top,
          insets.bottom,
          preferOpenAbove
        )
      );
      setVisible(true);
    });
  };

  const close = () => {
    setVisible(false);
  };

  const handleSelect = (u: Unit) => {
    haptics.light();
    onSelect(u);
    close();
  };

  return (
    <>
      <View ref={triggerRef} collapsable={false} style={containerStyle}>
        <TouchableOpacity
          onPress={open}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint="Opens unit options"
          style={[
            styles.trigger,
            {
              backgroundColor: theme.background,
              borderColor: theme.divider,
            },
            triggerStyle,
          ]}
        >
          <Text style={[theme.typography.body, { color: theme.textPrimary }]}>{currentUnit}</Text>
          <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      <AnchoredMenu visible={visible} onClose={close} layout={menuLayout} backdropVariant="menu">
        <View style={[styles.menu, { backgroundColor: theme.surface, ...theme.shadows.floating }]}>
          <UnitSelectionList
            value={currentUnit}
            onSelect={handleSelect}
            maxHeight={MENU_MAX_HEIGHT}
            showsVerticalScrollIndicator
          />
        </View>
      </AnchoredMenu>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: 72,
    minHeight: 44,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.input,
    borderWidth: 1,
  },
  menu: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    maxHeight: MENU_MAX_HEIGHT,
  },
});
