import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';
import type { GestureType } from 'react-native-gesture-handler';
import { useModalSheet } from './useModalSheet';
import { ModalSheetBackdrop } from './ModalSheetBackdrop';

type ModalSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Receives the pan gesture for the drag handle. */
  children: (pan: GestureType) => React.ReactNode;
  interactiveDismiss?: boolean;
  /** When true, keyboard overlays sheet (iOS standard); when false, KAV resizes. */
  keyboardOverlay?: boolean;
  contentContainerStyle?: ViewStyle;
};

/**
 * Bottom-attached sheet shell: shared backdrop + translateY motion.
 * Use the pan gesture only on the grabber / drag region.
 */
export function ModalSheet({
  visible,
  onClose,
  children,
  interactiveDismiss = true,
  keyboardOverlay = false,
  contentContainerStyle,
}: ModalSheetProps) {
  const { showModal, backdropAnimatedStyle, sheetAnimatedStyle, panGesture, onSheetLayout } =
    useModalSheet({
      visible,
      onClose,
      interactiveDismiss,
    });

  const sheetBody = (
    <Animated.View
      onLayout={onSheetLayout}
      style={[styles.sheetWrapper, sheetAnimatedStyle, contentContainerStyle]}
    >
      {children(panGesture)}
    </Animated.View>
  );

  return (
    <Modal
      visible={showModal}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container} pointerEvents="box-none">
        <ModalSheetBackdrop animatedStyle={backdropAnimatedStyle} onPress={onClose} />
        {keyboardOverlay ? (
          <View style={styles.keyboard} pointerEvents="box-none">
            {sheetBody}
          </View>
        ) : (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboard}
            pointerEvents="box-none"
          >
            {sheetBody}
          </KeyboardAvoidingView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  keyboard: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
  },
  sheetWrapper: {
    width: '100%',
  },
});
