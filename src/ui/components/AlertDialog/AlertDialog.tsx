import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { useTheme } from '../../../design/ThemeContext';
import { spacing } from '../../../design/spacing';
import { radius } from '../../../design/radius';
export type AlertDialogButton = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  cancel?: boolean;
};

export type AlertDialogProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  buttons: AlertDialogButton[];
  allowBackdropDismiss?: boolean;
  /**
   * `row` (default): trailing actions in a horizontal row (e.g. Cancel + Delete).
   * `column`: stacked trailing actions, right-aligned (standard for multi-step confirmations like duplicate item).
   */
  buttonLayout?: 'row' | 'column';
  /**
   * `leading` (default): title/message left-aligned; actions `flex-end` (standard for destructive confirmations).
   * `center`: title, message, and action row centered (informational single-action alerts).
   */
  contentAlignment?: 'leading' | 'center';
};

/**
 * Centered alert: fade + subtle scale (not a bottom sheet).
 * One progress value drives backdrop + card for synchronized motion.
 */
export function AlertDialog({
  visible,
  onClose,
  title,
  message,
  buttons,
  allowBackdropDismiss,
  buttonLayout = 'row',
  contentAlignment = 'leading',
}: AlertDialogProps) {
  const theme = useTheme();
  const hasDestructive = buttons.some((b) => b.destructive);
  const canDismiss = allowBackdropDismiss ?? !hasDestructive;
  const reduceMotion = useReduceMotion();

  const [isExiting, setIsExiting] = useState(false);
  const prevVisibleRef = useRef(visible);

  const scaleFrom = reduceMotion ? 0.998 : distance.dialogScaleFrom;

  const enterMs = motionMs(duration.alertEnter, reduceMotion);
  const exitMs = motionMs(duration.alertExit, reduceMotion);

  const enterCfg = useMemo(
    () => ({ duration: enterMs, easing: easing.easeOut }),
    [enterMs]
  );
  const exitCfg = useMemo(
    () => ({ duration: exitMs, easing: easing.easeIn }),
    [exitMs]
  );

  const progress = useSharedValue(0);

  const finishExit = () => setIsExiting(false);

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

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value * backdrop.dim,
  }));

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      {
        scale: interpolate(
          progress.value,
          [0, 1],
          [scaleFrom, 1]
        ),
      },
    ],
  }));

  const handleBackdropPress = () => {
    if (canDismiss) onClose();
  };

  if (!visible && !isExiting) return null;

  const showModal = visible || isExiting;
  const isCentered = contentAlignment === 'center';

  return (
    <Modal
      visible={showModal}
      transparent
      animationType="none"
      onRequestClose={canDismiss ? onClose : undefined}
      /** Cover another RN Modal (e.g. bottom sheet); otherwise the alert can render underneath on iOS. */
      {...(Platform.OS === 'ios' ? { presentationStyle: 'overFullScreen' as const } : {})}
      statusBarTranslucent
    >
      {/* When dismissed, visible is false while exit animation runs; without pointerEvents none,
          invisible backdrop still captures touches and freezes the screen below the Modal. */}
      <View style={styles.container} pointerEvents={visible ? 'box-none' : 'none'}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropAnimatedStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress} />
        </Animated.View>
        <Pressable onPress={(e) => e.stopPropagation()} style={styles.centered}>
          <Animated.View
            style={[
              styles.card,
              { backgroundColor: theme.surface, borderRadius: theme.radius.sheet, ...theme.shadows.floating },
              cardAnimatedStyle,
            ]}
          >
            <Text
              style={[
                theme.typography.headline,
                {
                  color: theme.textPrimary,
                  marginBottom: message ? theme.spacing.sm : theme.spacing.lg,
                  textAlign: isCentered ? 'center' : 'left',
                  width: '100%',
                },
              ]}
            >
              {title}
            </Text>
            {message ? (
              <Text
                style={[
                  theme.typography.body,
                  {
                    color: theme.textSecondary,
                    marginBottom: theme.spacing.lg,
                    textAlign: isCentered ? 'center' : 'left',
                    width: '100%',
                  },
                ]}
              >
                {message}
              </Text>
            ) : null}
            <View
              style={[
                buttonLayout === 'column' ? styles.buttonsColumn : styles.buttons,
                isCentered && styles.buttonsCentered,
                isCentered && buttonLayout === 'column' && styles.buttonsColumnCentered,
              ]}
            >
              {buttons.map((btn) => {
                const isCancel = btn.cancel;
                const isDestructive = btn.destructive && !isCancel;
                const bg = isCancel ? 'transparent' : isDestructive ? theme.danger : theme.accent;
                const fg = isCancel ? theme.textPrimary : isDestructive ? theme.onDanger : theme.onAccent;
                return (
                  <Pressable
                    key={btn.label}
                    onPress={() => {
                      btn.onPress();
                      onClose();
                    }}
                    style={({ pressed }) => [
                      styles.button,
                      { backgroundColor: bg },
                      isCancel && {
                        backgroundColor: 'transparent',
                        borderWidth: 1,
                        borderColor: theme.divider,
                      },
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Text style={[theme.typography.headline, { color: fg }]}>{btn.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    backgroundColor: 'rgba(0,0,0,1)',
  },
  centered: {
    width: '100%',
    maxWidth: 320,
    marginHorizontal: spacing.lg,
  },
  card: {
    padding: spacing.lg,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  buttonsColumn: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    alignSelf: 'stretch',
    gap: spacing.sm,
  },
  buttonsCentered: {
    justifyContent: 'center',
  },
  buttonsColumnCentered: {
    alignItems: 'center',
  },
  button: {
    minHeight: 44,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.8,
  },
});
