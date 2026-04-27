import React from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Dimensions,
  type StyleProp,
  type ViewStyle,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../design/ThemeContext';
import { GlassSurface } from './GlassSurface';
import { ModalSheetBackdrop } from '../../ui/components/ModalSheet/ModalSheetBackdrop';
import { useModalSheet } from '../../ui/components/ModalSheet/useModalSheet';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  size?: 'default' | 'form';
  /** When true, keyboard overlays the sheet (iOS standard). When false, sheet resizes to avoid keyboard. */
  keyboardOverlay?: boolean;
  /**
   * When `reanimated`, sheet vertical position follows the system keyboard via Reanimated (smooth stacking with text fields).
   * When omitted, uses `keyboardOverlay` + KeyboardAvoidingView as before.
   */
  keyboardLift?: 'padding' | 'reanimated';
  /** When true, reduces top padding and handle spacing for a tighter header area */
  compactHeader?: boolean;
  /** When true, content area fills space below the handle so nested ScrollViews can flex to the sheet bottom */
  expandContent?: boolean;
  /** When size is form, use a shorter min height (quick-add / compact state). */
  formCompact?: boolean;
  /**
   * When true with size=form: no min-height snap — sheet height follows content up to maxHeight.
   * Use for quick-add style UIs; other form sheets keep default min-height + flex fill.
   */
  formHugContent?: boolean;
  /** When true, drag down on the grabber to dismiss. */
  interactiveDismiss?: boolean;
  /** Visual surface treatment. Glass is translucent; solid is opaque (preferred for forms that must not dim). */
  surfaceVariant?: 'glass' | 'solid';
  /** When false, sheet body has no horizontal padding (use when children manage their own insets). */
  padContent?: boolean;
  /** Called the moment the slide-in starts (after measured height is applied, before withTiming). */
  onEnterAnimationStart?: () => void;
  /**
   * Called after the sheet slide-in completes. With keyboardLift="reanimated", focus text fields here so the
   * keyboard animates only after the sheet rests (avoids the keyboard window covering a sliding sheet).
   */
  onPresented?: () => void;
  /** Called the moment the slide-out starts (same frame as modal exit timing). Blur/dismiss keyboard here with KAV. */
  onExitAnimationStart?: () => void;
  /** Called after the sheet’s dismiss animation finishes (native Modal is done exiting). */
  onDismissed?: () => void;
  /** Visual semantics for this sheet surface. */
  presentationVariant?: 'form' | 'action' | 'passive';
  /** Optional test identifier for automation. */
  testID?: string;
};

/**
 * iOS-style bottom sheet: rounded top corners, grabber, glass or solid surface.
 * Motion: single translateY + backdrop derived from the same motion (see useModalSheet).
 */
export function BottomSheet({
  visible,
  onClose,
  children,
  style,
  size = 'default',
  keyboardOverlay = false,
  keyboardLift,
  compactHeader = false,
  expandContent = false,
  formCompact = false,
  interactiveDismiss = true,
  surfaceVariant = 'glass',
  padContent = true,
  onEnterAnimationStart,
  onPresented,
  onExitAnimationStart,
  onDismissed,
  formHugContent = false,
  presentationVariant = 'passive',
  testID,
}: BottomSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = Dimensions.get('window');
  const isForm = size === 'form';

  const useReanimatedKeyboardLift = keyboardLift === 'reanimated';
  const wrapWithKeyboardPadding =
    !useReanimatedKeyboardLift && !keyboardOverlay;

  /** Fills the gap between sheet bottom and keyboard when KAV adds bottom inset (avoids dimmed backdrop showing through). */
  const keyboardSurfaceBleed =
    wrapWithKeyboardPadding && surfaceVariant === 'solid';
  const keyboardBleedHeight = Math.min(windowHeight * 0.5, 440);

  const {
    showModal,
    backdropAnimatedStyle,
    sheetAnimatedStyle,
    panGesture,
    onSheetLayout,
  } = useModalSheet({
    visible,
    onClose,
    interactiveDismiss,
    syncKeyboardLift: useReanimatedKeyboardLift,
    onEnterAnimationStart,
    onPresented,
    onExitAnimationStart,
    onDismissed,
  });

  const minHeightRatio = isForm ? (formCompact ? 0.34 : 0.5) : 0.55;
  const formMinPx = isForm ? (formCompact ? 200 : 300) : 380;
  const minHComputed = Math.max(windowHeight * minHeightRatio, formMinPx);

  const formSurfaceStyle = isForm
    ? formHugContent
      ? { maxHeight: windowHeight * 0.9 }
      : { minHeight: minHComputed, maxHeight: windowHeight * 0.9 }
    : { minHeight: minHComputed };

  const contentFormStyle = isForm
    ? formHugContent
      ? styles.contentFormHug
      : styles.contentForm
    : null;

  const sheetContent = (
    <>
      {surfaceVariant === 'glass' ? (
        <GlassSurface
          fillVariant="sheet"
          style={[
            styles.sheet,
            {
              paddingBottom: isForm ? 0 : Math.max(theme.spacing.xl, insets.bottom),
              ...formSurfaceStyle,
              ...(compactHeader && { paddingTop: theme.spacing.xs }),
            },
            theme.shadows.floating,
            style,
          ]}
          borderRadius={theme.radius.sheet}
        >
          <GestureDetector gesture={panGesture}>
            <View style={[styles.handleHit, compactHeader && styles.handleHitCompact]}>
              <View
                style={[
                  styles.handle,
                  { backgroundColor: theme.divider },
                  compactHeader && styles.handleCompact,
                ]}
              />
            </View>
          </GestureDetector>
          <View
            style={[
              styles.content,
              !padContent && styles.contentFlush,
              contentFormStyle,
              expandContent && !formHugContent && styles.contentExpand,
            ]}
          >
            {children}
          </View>
        </GlassSurface>
      ) : (
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              paddingBottom: isForm ? 0 : Math.max(theme.spacing.xl, insets.bottom),
              ...formSurfaceStyle,
              ...(compactHeader && { paddingTop: theme.spacing.xs }),
            },
            theme.shadows.floating,
            style,
          ]}
        >
          <GestureDetector gesture={panGesture}>
            <View style={[styles.handleHit, compactHeader && styles.handleHitCompact]}>
              <View
                style={[
                  styles.handle,
                  { backgroundColor: theme.divider },
                  compactHeader && styles.handleCompact,
                ]}
              />
            </View>
          </GestureDetector>
          <View
            style={[
              styles.content,
              !padContent && styles.contentFlush,
              contentFormStyle,
              expandContent && !formHugContent && styles.contentExpand,
            ]}
          >
            {children}
          </View>
        </View>
      )}
    </>
  );

  const animatedSheet = (
    <Animated.View
      onLayout={onSheetLayout}
      style={[
        styles.sheetWrapper,
        keyboardSurfaceBleed && styles.sheetWrapperWithBleed,
        sheetAnimatedStyle,
      ]}
      accessibilityLabel={presentationVariant === 'form' ? 'Input sheet' : undefined}
    >
      {sheetContent}
      {keyboardSurfaceBleed ? (
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.keyboardSurfaceBleed,
            {
              height: keyboardBleedHeight,
              backgroundColor: theme.surface,
              /** Hide immediately when dismiss starts (`visible` false); avoids strip sliding out of sync with KAV + sheet. */
              opacity: visible ? 1 : 0,
            },
          ]}
        />
      ) : null}
    </Animated.View>
  );

  return (
    <Modal
      visible={showModal}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      testID={testID}
      {...(Platform.OS === 'ios' && { presentationStyle: 'overFullScreen' as const })}
    >
      <View
        style={styles.container}
        pointerEvents={visible ? 'box-none' : 'none'}
        accessibilityViewIsModal={showModal}
      >
        <ModalSheetBackdrop
          animatedStyle={backdropAnimatedStyle}
          onPress={onClose}
          testID={testID ? `${testID}-backdrop` : undefined}
        />
        {wrapWithKeyboardPadding ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboard}
            pointerEvents="box-none"
          >
            {animatedSheet}
          </KeyboardAvoidingView>
        ) : (
          <View style={styles.keyboard} pointerEvents="box-none">
            {animatedSheet}
          </View>
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
  /** Allows the bleed strip to extend below the card without clipping. */
  sheetWrapperWithBleed: {
    overflow: 'visible',
  },
  /**
   * Continues the solid surface under the keyboard region so the sheet reads as one block
   * (KeyboardAvoidingView padding otherwise exposes the modal backdrop between card and keyboard).
   */
  keyboardSurfaceBleed: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '100%',
  },
  sheet: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: spacing.sm,
    maxHeight: '90%',
  },
  handleHit: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  handleHitCompact: {
    paddingBottom: spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  handleCompact: {
    marginBottom: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.md,
  },
  contentFlush: {
    paddingHorizontal: 0,
  },
  contentForm: {
    flex: 1,
    minHeight: 0,
  },
  /** Form sheet when formHugContent: do not stretch to fill min-height; height follows children. */
  contentFormHug: {
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 0,
    alignSelf: 'stretch',
  },
  contentExpand: {
    flex: 1,
    minHeight: 0,
  },
});
