import { requireNativeViewManager } from 'expo-modules-core';
import { Platform, View, type ViewProps } from 'react-native';

export type KeyboardComposerHostProps = ViewProps & {
  /** When true, hides the UITabBar while the keyboard is visible. iOS only. Default true. */
  hidesTabBarOnKeyboard?: boolean;
};

const NativeKeyboardComposerHost =
  Platform.OS === 'ios' ? requireNativeViewManager<KeyboardComposerHostProps>('ListioKeyboardComposer') : null;

/**
 * iOS-only passthrough wrapper. Does not position children — only syncs the parent
 * `UITabBar` visibility with the system keyboard, using Apple's actual animation curve
 * pulled from `UIKeyboardAnimationCurveUserInfoKey`.
 *
 * Composer position is driven by `react-native-keyboard-controller`'s
 * `useReanimatedKeyboardAnimation()` — native frame-by-frame keyboard observation pushed
 * into a Reanimated shared value on the UI thread, so the composer follows the keyboard's
 * private spring exactly (including during interactive drag-down dismissal).
 */
export function KeyboardComposerHost({
  hidesTabBarOnKeyboard = true,
  children,
  ...rest
}: KeyboardComposerHostProps) {
  if (NativeKeyboardComposerHost) {
    return (
      <NativeKeyboardComposerHost hidesTabBarOnKeyboard={hidesTabBarOnKeyboard} collapsable={false} {...rest}>
        {children}
      </NativeKeyboardComposerHost>
    );
  }

  return <View {...rest}>{children}</View>;
}
