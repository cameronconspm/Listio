import React from 'react';
import { Platform, View, StyleSheet, type ViewStyle } from 'react-native';
import { PressableScale } from './PressableScale';

type HeaderIconButtonProps = {
  children: React.ReactNode;
  onPress: () => void;
  hitSlop?: number;
  style?: ViewStyle;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

/**
 * Nav pill / header icon button: optically centered, consistent 44pt hit target.
 * Use for back pills, heart, overflow, and similar header actions.
 */
export function HeaderIconButton({
  children,
  onPress,
  hitSlop = 12,
  style,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
}: HeaderIconButtonProps) {
  return (
    <PressableScale
      accessibilityRole={accessibilityLabel ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      disabled={disabled}
      hitSlop={{ top: hitSlop, bottom: hitSlop, left: hitSlop, right: hitSlop }}
      style={[styles.button, style]}
    >
      <View style={styles.content}>{children}</View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  content: {
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    /**
     * Ionicon glyphs often sit low in the font box vs native header chrome (SF Symbols back button).
     * Tiny upward shift for optical vertical center in 44pt header targets.
     */
    ...Platform.select({
      ios: { transform: [{ translateY: -1.5 }] },
      default: { transform: [{ translateY: -0.5 }] },
    }),
  },
});
