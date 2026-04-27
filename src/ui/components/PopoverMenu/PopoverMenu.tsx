import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { useReduceMotion } from '../../motion/useReduceMotion';
import { backdrop, distance, duration, easing } from '../../motion/tokens';
import { motionMs } from '../../motion/presets';

export type PopoverMenuLayout = {
  x: number;
  y: number;
  width: number;
};

type PopoverMenuProps = {
  visible: boolean;
  onClose: () => void;
  layout: PopoverMenuLayout | null;
  children: React.ReactNode;
  backdropVariant?: 'menu' | 'dim';
  style?: ViewStyle;
};

/**
 * Anchored menu: short fade + slight scale + small vertical nudge (attached to trigger).
 */
export function PopoverMenu({
  visible,
  onClose,
  layout,
  children,
  backdropVariant = 'menu',
  style,
}: PopoverMenuProps) {
  const reduceMotion = useReduceMotion();

  const [isExiting, setIsExiting] = useState(false);
  const prevVisibleRef = useRef(visible);
  const showModal = visible || isExiting;

  const lastLayoutRef = useRef<PopoverMenuLayout | null>(null);
  if (layout) lastLayoutRef.current = layout;
  const effectiveLayout = layout ?? lastLayoutRef.current;

  const enterMs = motionMs(duration.menuPresent, reduceMotion);
  const exitMs = motionMs(duration.menuDismiss, reduceMotion);

  const enterCfg = useMemo(
    () => ({ duration: enterMs, easing: easing.easeOut }),
    [enterMs]
  );
  const exitCfg = useMemo(
    () => ({ duration: exitMs, easing: easing.easeIn }),
    [exitMs]
  );

  const progress = useSharedValue(0);
  const reduceSV = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    reduceSV.value = reduceMotion ? 1 : 0;
  }, [reduceMotion, reduceSV]);

  const finishExit = () => setIsExiting(false);

  const backdropOpacity = useMemo(
    () => (backdropVariant === 'dim' ? backdrop.dim : backdrop.dimMenu),
    [backdropVariant]
  );

  useEffect(() => {
    const wasVisible = prevVisibleRef.current;
    prevVisibleRef.current = visible;

    if (visible) {
      setIsExiting(false);
      progress.value = 0;
      progress.value = withTiming(1, enterCfg);
    } else if (wasVisible) {
      setIsExiting(true);
      progress.value = withTiming(0, exitCfg, (finished) => {
        if (finished) runOnJS(finishExit)();
      });
    }
  }, [visible, enterCfg, exitCfg, progress]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value * backdropOpacity,
  }));

  const menuStyle = useAnimatedStyle(() => {
    const scaleFrom = reduceSV.value ? 1 : distance.menuScaleFrom;
    const tyFrom = reduceSV.value ? 0 : -distance.popoverTranslate;
    return {
      opacity: progress.value,
      transform: [
        {
          scale: interpolate(progress.value, [0, 1], [scaleFrom, 1]),
        },
        {
          translateY: interpolate(progress.value, [0, 1], [tyFrom, 0]),
        },
      ],
    };
  });

  if (!showModal) return null;

  return (
    <Modal
      visible={showModal}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container} pointerEvents="box-none" accessibilityViewIsModal={showModal}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Dismiss menu"
          />
        </Animated.View>
        {effectiveLayout ? (
          <Animated.View
            style={[
              styles.menu,
              {
                left: effectiveLayout.x,
                top: effectiveLayout.y,
                width: effectiveLayout.width,
              },
              menuStyle,
              style,
            ]}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>{children}</Pressable>
          </Animated.View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backdrop: { backgroundColor: 'rgba(0,0,0,1)' },
  menu: {
    position: 'absolute',
  },
});
