import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Pressable, Text, Platform, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { useTheme } from '../../design/ThemeContext';
import { spring } from '../../ui/motion/tokens';
import { useHaptics } from '../../hooks/useHaptics';
import { spacing } from '../../design/spacing';

/** Apple HIG-style minimum along the short edge; pill height matches for a clear touch target. */
const ICON_SIZE = 56;
/** Horizontal inset inside the pill (each side). Tight but readable. */
const FAB_INSET_H = 12;
const ICON_SLOT_W = 28;
/** Space between + and label (matches expanded labelStyle marginLeft). */
const ICON_LABEL_GAP = spacing.xs;
/** Extra width so glyph edges / rounding don’t clip (pt). */
const LABEL_WIDTH_BUFFER = 8;
/**
 * Fallback label width before measure (subhead semibold; 7.5 was too tight and caused “Add it…” until onLayout).
 */
const ESTIMATED_CHAR_WIDTH_PX = 9.25;

type FloatingAddButtonProps = {
  onPress: () => void;
  /**
   * 1 = full pill, 0 = + only.
   * Parent drives this from scroll phase (collapse while dragging / momentum, spring settle when idle).
   * Omit to keep the pill fully expanded (static tabs like Recipes).
   */
  expandProgress?: SharedValue<number>;
  bottom: number;
  contextualZoneLabel?: string | null;
  /** When there is no contextual zone (List tab), pill label. Default “Add item”. */
  addLabel?: string;
  /** VoiceOver / TalkBack hint for the button. */
  accessibilityHint?: string;
  /**
   * Optional cap on expanded pill width (e.g. design review). Default: content + screen clamp only.
   */
  maxExpandedWidthPx?: number;
  /** Override auto-derived label max width (rare). */
  labelMaxWidth?: number;
};

export function FloatingAddButton({
  onPress,
  expandProgress,
  bottom,
  contextualZoneLabel,
  addLabel = 'Add item',
  accessibilityHint: accessibilityHintProp,
  maxExpandedWidthPx,
  labelMaxWidth: labelMaxWidthProp,
}: FloatingAddButtonProps) {
  const theme = useTheme();
  const haptics = useHaptics();
  const { width: windowWidth } = useWindowDimensions();
  const [measuredLabelW, setMeasuredLabelW] = useState(0);

  const displayLabel = contextualZoneLabel ? `Add to ${contextualZoneLabel}` : addLabel;
  const a11yLabel = displayLabel;
  const a11yHint = accessibilityHintProp ?? 'Opens the add item sheet';

  useEffect(() => {
    setMeasuredLabelW(0);
  }, [displayLabel]);

  const intrinsicLabelW = useMemo(() => {
    if (measuredLabelW > 0) return measuredLabelW;
    // Conservative pre-measure width so the pill isn’t narrower than the glyph run on first paint.
    return Math.ceil(displayLabel.length * ESTIMATED_CHAR_WIDTH_PX) + LABEL_WIDTH_BUFFER;
  }, [measuredLabelW, displayLabel]);

  const expandedWidthPx = useMemo(() => {
    const anchorGutter = theme.spacing.md * 2 + theme.spacing.xs;
    const maxPill = Math.max(ICON_SIZE, windowWidth - anchorGutter);
    /** +2: sub-pixel / rounding slack between measure-only Text and on-screen pill. */
    const contentW = FAB_INSET_H * 2 + ICON_SLOT_W + ICON_LABEL_GAP + intrinsicLabelW + 2;
    let w = Math.min(maxPill, Math.max(ICON_SIZE, contentW));
    if (maxExpandedWidthPx != null) {
      w = Math.min(w, maxExpandedWidthPx);
    }
    return w;
  }, [windowWidth, intrinsicLabelW, maxExpandedWidthPx, theme.spacing.md, theme.spacing.xs]);

  const effectiveLabelMaxWidth = useMemo(() => {
    if (labelMaxWidthProp != null) return labelMaxWidthProp;
    const inner = expandedWidthPx - FAB_INSET_H * 2;
    return Math.max(48, inner - ICON_SLOT_W - ICON_LABEL_GAP);
  }, [expandedWidthPx, labelMaxWidthProp]);

  const defaultExpandProgress = useSharedValue(1);
  const expandSV = expandProgress ?? defaultExpandProgress;

  const pressProgress = useSharedValue(0);
  const expandedWidthSV = useSharedValue(expandedWidthPx);

  useEffect(() => {
    expandedWidthSV.value = expandedWidthPx;
  }, [expandedWidthPx, expandedWidthSV]);

  const pillStyle = useAnimatedStyle(() => {
    const p = expandSV.value;
    const cap = expandedWidthSV.value;
    const w = ICON_SIZE + (cap - ICON_SIZE) * p;
    return { width: w };
  });

  const labelStyle = useAnimatedStyle(() => {
    const p = expandSV.value;
    return {
      opacity: p,
      maxWidth: p * effectiveLabelMaxWidth,
      marginLeft: p * ICON_LABEL_GAP,
    };
  }, [effectiveLabelMaxWidth]);

  const iconStyle = useAnimatedStyle(() => {
    const p = expandSV.value;
    return {
      transform: [
        {
          scale: interpolate(p, [0, 1], [1.01, 1], Extrapolation.CLAMP),
        },
      ],
    };
  });

  const pressStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(pressProgress.value, [0, 1], [1, 0.96], Extrapolation.CLAMP),
      },
    ],
  }));

  const handlePress = useCallback(() => {
    requestAnimationFrame(() => {
      onPress();
    });
  }, [onPress]);

  return (
    <Animated.View
      style={[styles.anchor, { bottom }, pressStyle]}
      pointerEvents="box-none"
    >
      <View
        pointerEvents="none"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={styles.measureOnly}
      >
        <Text
          style={[theme.typography.subhead, styles.labelText, { color: theme.textPrimary }]}
          onLayout={(e) => {
            const w = Math.ceil(e.nativeEvent.layout.width);
            if (w > 0) setMeasuredLabelW((prev) => (w > prev ? w : prev));
          }}
          onTextLayout={(e) => {
            const line = e.nativeEvent.lines[0];
            const w = line != null ? Math.ceil(line.width) : 0;
            if (w > 0) setMeasuredLabelW((prev) => (w > prev ? w : prev));
          }}
        >
          {displayLabel}
        </Text>
      </View>
      <Animated.View
        style={[
          styles.pill,
          { backgroundColor: theme.accent },
          theme.shadows.floating,
          pillStyle,
        ]}
      >
        <Pressable
          onPressIn={() => {
            haptics.light();
            pressProgress.value = withSpring(1, spring.fabPress);
          }}
          onPressOut={() => {
            pressProgress.value = withSpring(0, spring.fabPress);
          }}
          onPress={handlePress}
          style={styles.pressInner}
          accessibilityRole="button"
          accessibilityLabel={a11yLabel}
          accessibilityHint={a11yHint}
        >
          <Animated.View style={styles.contentRow}>
            <Animated.View style={[styles.iconWrap, iconStyle]}>
              <Ionicons name="add" size={28} color={theme.onAccent} />
            </Animated.View>
            <Animated.View style={[styles.labelWrap, labelStyle]} pointerEvents="none">
              <Text
                style={[theme.typography.subhead, styles.labelText, { color: theme.onAccent }]}
                numberOfLines={1}
              >
                {displayLabel}
              </Text>
            </Animated.View>
          </Animated.View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    alignSelf: 'flex-end',
    right: spacing.md,
    zIndex: 20,
  },
  /** Off-screen single-line measure so pill width matches label without a fixed 288px cap. */
  measureOnly: {
    position: 'absolute',
    left: -2000,
    top: 0,
    opacity: 0,
  },
  pill: {
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    overflow: 'hidden',
    minWidth: ICON_SIZE,
  },
  pressInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: ICON_SIZE,
    paddingHorizontal: FAB_INSET_H,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '100%',
    flexShrink: 1,
  },
  iconWrap: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelWrap: {
    flexShrink: 1,
    minWidth: 0,
  },
  labelText: {
    fontWeight: '600',
    letterSpacing: 0.2,
    ...Platform.select({
      android: { includeFontPadding: false },
      default: {},
    }),
  },
});
