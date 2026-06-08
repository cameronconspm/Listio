import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../design/ThemeContext';
import { cardShellStyle } from '../ui/Card';
import { useHaptics } from '../../hooks/useHaptics';
import { useReduceMotion } from '../../ui/motion/useReduceMotion';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';

type NearbyStorePromptBannerProps = {
  visible: boolean;
  title: string;
  distanceLabel: string;
  onAdd: () => void;
  onDismiss: () => void;
};

const OFFSCREEN_Y = -140;

/**
 * Non-blocking slide-in over list content. Anchored below the stack header (transparent chrome)
 * so it does not sit under the status bar; does not reserve layout space in the parent.
 */
export function NearbyStorePromptBanner({
  visible,
  title,
  distanceLabel,
  onAdd,
  onDismiss,
}: NearbyStorePromptBannerProps) {
  const theme = useTheme();
  const haptics = useHaptics();
  const reduceMotion = useReduceMotion();
  const headerHeight = useHeaderHeight();
  const bannerTop = headerHeight + theme.spacing.sm;
  const translateY = useSharedValue(OFFSCREEN_Y);
  const opacity = useSharedValue(0);
  const [mounted, setMounted] = useState(visible);
  const didHapticRef = useRef(false);

  const finishHide = () => setMounted(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      if (reduceMotion) {
        translateY.value = withTiming(0, { duration: 220 });
        opacity.value = withTiming(1, { duration: 160 });
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 220 });
        opacity.value = withTiming(1, { duration: 220 });
      }
      if (!didHapticRef.current) {
        didHapticRef.current = true;
        haptics.light();
      }
      return;
    }

    didHapticRef.current = false;
    if (reduceMotion) {
      opacity.value = withTiming(0, { duration: 120 });
      translateY.value = withTiming(OFFSCREEN_Y, { duration: 180 }, (finished) => {
        if (finished) {
          runOnJS(finishHide)();
        }
      });
    } else {
      opacity.value = withTiming(0, { duration: 180 });
      translateY.value = withSpring(OFFSCREEN_Y, { damping: 22, stiffness: 260 }, (finished) => {
        if (finished) {
          runOnJS(finishHide)();
        }
      });
    }
  }, [visible, translateY, opacity, haptics, reduceMotion]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!mounted) {
    return null;
  }

  return (
    <Animated.View
      style={[styles.outer, { top: bannerTop }, animStyle]}
      pointerEvents={visible ? 'box-none' : 'none'}
      accessibilityElementsHidden={!visible}
    >
      <View
        style={[
          styles.card,
          cardShellStyle(theme, 'raised', 'status'),
        ]}
      >
        <View style={styles.row}>
          <View style={styles.textCol}>
            <Text style={[theme.typography.subhead, { color: theme.textPrimary }]} numberOfLines={2}>
              Near store
            </Text>
            <Text style={[theme.typography.footnote, { color: theme.textSecondary }]} numberOfLines={2}>
              {title} · {distanceLabel}
            </Text>
          </View>
          <Ionicons name="location" size={22} color={theme.accent} style={styles.pin} />
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={() => {
              haptics.light();
              onDismiss();
            }}
            hitSlop={8}
            style={styles.actionBtn}
            accessibilityRole="button"
            accessibilityLabel="Dismiss nearby store suggestion"
          >
            <Text style={[theme.typography.subhead, { color: theme.textSecondary }]}>Not now</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              haptics.light();
              onAdd();
            }}
            hitSlop={8}
            style={styles.actionBtn}
            accessibilityRole="button"
            accessibilityLabel="Add this store"
          >
            <Text style={[theme.typography.subhead, { color: theme.accent }]}>Add store</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 20,
    elevation: 10,
  },
  card: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  textCol: { flex: 1, justifyContent: 'center', paddingRight: spacing.sm },
  pin: { marginTop: 2 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  actionBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
});
