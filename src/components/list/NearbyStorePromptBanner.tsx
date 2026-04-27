import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../../design/ThemeContext';
import { useHaptics } from '../../hooks/useHaptics';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';

type NearbyStorePromptBannerProps = {
  visible: boolean;
  title: string;
  distanceLabel: string;
  onAdd: () => void;
  onDismiss: () => void;
};

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
  const headerHeight = useHeaderHeight();
  const bannerTop = headerHeight + theme.spacing.sm;
  const translateY = useSharedValue(-140);
  const didHapticRef = useRef(false);

  useEffect(() => {
    translateY.value = withSpring(visible ? 0 : -140, { damping: 20, stiffness: 220 });
    if (visible && !didHapticRef.current) {
      didHapticRef.current = true;
      haptics.light();
    }
    if (!visible) {
      didHapticRef.current = false;
    }
  }, [visible, translateY, haptics]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      style={[styles.outer, { top: bannerTop }, animStyle]}
      pointerEvents="box-none"
      accessibilityElementsHidden={!visible}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.surface,
            borderColor: theme.divider,
            shadowColor: theme.textPrimary,
          },
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
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
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
