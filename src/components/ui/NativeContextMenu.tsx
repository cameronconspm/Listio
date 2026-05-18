import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { MenuView, type MenuAction } from '@react-native-menu/menu';
import { useTheme } from '../../design/ThemeContext';
import { AppActionSheet } from './AppActionSheet';

export type NativeContextMenuAction = {
  id: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
  systemImage?: string;
};

type NativeContextMenuProps = {
  actions: NativeContextMenuAction[];
  children: React.ReactNode;
  title?: string;
  shouldOpenOnLongPress?: boolean;
  isAnchoredToRight?: boolean;
  hitSlop?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

export function NativeContextMenu({
  actions,
  children,
  title,
  shouldOpenOnLongPress = false,
  isAnchoredToRight = false,
  hitSlop = 8,
  style,
  accessibilityLabel,
  testID,
}: NativeContextMenuProps) {
  const theme = useTheme();
  const [fallbackVisible, setFallbackVisible] = useState(false);
  const nativeActions = useMemo<MenuAction[]>(
    () =>
      actions.map((action) => ({
        id: action.id,
        title: action.label,
        attributes: {
          destructive: action.destructive,
          disabled: action.disabled,
        },
        image: Platform.OS === 'ios' ? action.systemImage : undefined,
      })),
    [actions]
  );

  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    return (
      <MenuView
        title={title}
        actions={nativeActions}
        shouldOpenOnLongPress={shouldOpenOnLongPress}
        isAnchoredToRight={isAnchoredToRight}
        themeVariant={theme.colorScheme}
        hitSlop={{ top: hitSlop, right: hitSlop, bottom: hitSlop, left: hitSlop }}
        testID={testID}
        style={style}
        onPressAction={({ nativeEvent }) => {
          actions.find((action) => action.id === nativeEvent.event)?.onPress();
        }}
      >
        {children}
      </MenuView>
    );
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={() => setFallbackVisible(true)}
        onLongPress={shouldOpenOnLongPress ? () => setFallbackVisible(true) : undefined}
        style={({ pressed }) => [styles.fallbackTrigger, style, pressed && { opacity: 0.7 }]}
        testID={testID}
      >
        {children}
      </Pressable>
      <AppActionSheet
        visible={fallbackVisible}
        onClose={() => setFallbackVisible(false)}
        title={title}
        actions={actions.map((action) => ({
          label: action.label,
          destructive: action.destructive,
          onPress: action.onPress,
        }))}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fallbackTrigger: {
    alignSelf: 'flex-start',
  },
});
