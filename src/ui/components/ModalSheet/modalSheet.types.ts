import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import type { GestureType } from 'react-native-gesture-handler';

export type UseModalSheetOptions = {
  visible: boolean;
  onClose: () => void;
  interactiveDismiss: boolean;
  /**
   * When true, sheet translateY is combined with an animated keyboard inset so lift tracks the system
   * keyboard (iOS: RN Keyboard frame events + timing; Android: useAnimatedKeyboard). Use with
   * BottomSheet keyboardLift="reanimated".
   */
  syncKeyboardLift?: boolean;
  /** Fires on the JS thread the moment the slide-in animation starts (after measured height is applied). Use to focus fields in sync with the sheet motion. */
  onEnterAnimationStart?: () => void;
  /** Fires once when the enter animation has fully completed (translateY at rest). */
  onPresented?: () => void;
  /**
   * Fires on the JS thread the moment the slide-out animation starts (same timing as modal exit).
   * Use with KeyboardAvoidingView sheets to blur + dismiss keyboard in parallel with the sheet.
   */
  onExitAnimationStart?: () => void;
  /** Fires once when the dismiss exit animation has fully completed (Modal can unmount safely). */
  onDismissed?: () => void;
};

export type UseModalSheetResult = {
  showModal: boolean;
  backdropAnimatedStyle: StyleProp<ViewStyle>;
  sheetAnimatedStyle: StyleProp<ViewStyle>;
  panGesture: GestureType;
  onSheetLayout: (e: LayoutChangeEvent) => void;
};
