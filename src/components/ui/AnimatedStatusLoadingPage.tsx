import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../design/ThemeContext';

type IoniconName = keyof typeof Ionicons.glyphMap;

type AnimatedStatusLoadingPageProps = {
  title: string;
  statusMessages: readonly string[];
  detail?: string;
  icons?: readonly IoniconName[];
  contentPaddingTop?: number;
  /** Drives the bar; only moves forward when controlled. */
  progressFraction?: number;
  /** When provided, status copy is driven externally (no reset on mount). */
  statusIndex?: number;
  /** Icon entrance animation — off when overlay remounts mid-bootstrap. */
  animateIconsOnMount?: boolean;
};

const DEFAULT_ICONS = [
  'sparkles',
  'color-wand-outline',
  'reader-outline',
] as const satisfies readonly IoniconName[];

export function AnimatedStatusLoadingPage({
  title,
  statusMessages,
  detail,
  icons = DEFAULT_ICONS,
  contentPaddingTop = 0,
  progressFraction,
  statusIndex: statusIndexProp,
  animateIconsOnMount = true,
}: AnimatedStatusLoadingPageProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const rm = useReducedMotion();

  const [trackWidth, setTrackWidth] = useState(0);
  const [internalStatusIndex, setInternalStatusIndex] = useState(0);
  const progress = useSharedValue(progressFraction ?? 0);
  const displayedProgressRef = useRef(progressFraction ?? 0);
  const iconsAnimatedRef = useRef(!animateIconsOnMount);

  const messages = statusMessages.length > 0 ? statusMessages : ['Loading…'];
  const statusIndex = statusIndexProp ?? internalStatusIndex;
  const controlled = progressFraction != null;

  useEffect(() => {
    if (controlled) return;
    progress.value = 0;
    progress.value = withTiming(0.92, {
      duration: rm ? 400 : 11_000,
      easing: Easing.out(Easing.cubic),
    });
  }, [controlled, rm, progress]);

  useEffect(() => {
    if (controlled || statusIndexProp != null) return;
    const intervalMs = rm ? 2200 : 1400;
    const id = setInterval(() => {
      setInternalStatusIndex((i) => (i + 1) % messages.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [controlled, statusIndexProp, messages.length, rm]);

  useEffect(() => {
    if (!controlled || progressFraction == null) return;
    const next = Math.min(1, Math.max(0, progressFraction));
    const prev = displayedProgressRef.current;
    if (next <= prev) return;
    displayedProgressRef.current = next;
    progress.value = withTiming(next, {
      duration: rm ? 80 : next >= 1 ? 320 : 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [controlled, progressFraction, rm, progress]);

  const progressFillStyle = useAnimatedStyle(() => ({
    width: Math.max(0, trackWidth * progress.value),
  }));

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: theme.spacing.lg,
          paddingTop: insets.top + contentPaddingTop + theme.spacing.md,
          paddingBottom: insets.bottom + theme.spacing.lg,
        },
        card: {
          width: Math.min(360, windowWidth - theme.spacing.lg * 2),
          borderRadius: theme.radius.xl,
          backgroundColor: theme.surface,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.lg + theme.spacing.xs,
          overflow: 'hidden' as const,
          ...theme.shadows.floating,
        },
        iconRow: {
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          alignSelf: 'stretch',
          flexWrap: 'nowrap' as const,
          gap: theme.spacing.sm,
          marginBottom: theme.spacing.md,
          overflow: 'hidden' as const,
        },
        iconCell: {
          width: 34,
          height: 34,
          alignItems: 'center',
          justifyContent: 'center',
        },
        title: {
          ...theme.typography.title2,
          color: theme.textPrimary,
          textAlign: 'center',
          marginBottom: theme.spacing.sm,
        },
        statusLine: {
          ...theme.typography.body,
          color: theme.textPrimary,
          textAlign: 'center',
          fontWeight: '600',
          marginBottom: theme.spacing.md,
          minHeight: 24,
        },
        detail: {
          ...theme.typography.footnote,
          color: theme.textSecondary,
          textAlign: 'center',
          lineHeight: 20,
          marginBottom: theme.spacing.lg,
        },
        track: {
          height: 8,
          borderRadius: theme.radius.full,
          backgroundColor: theme.surfaceGlass,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.divider,
          overflow: 'hidden' as const,
        },
        fill: {
          height: '100%',
          borderRadius: theme.radius.full,
          backgroundColor: theme.accent,
        },
      }),
    [theme, insets.top, insets.bottom, windowWidth, contentPaddingTop]
  );

  const showIconEntrance = animateIconsOnMount && !iconsAnimatedRef.current;
  if (showIconEntrance) iconsAnimatedRef.current = true;

  return (
    <View style={styles.root} accessibilityRole="progressbar" accessibilityLabel={title}>
      <View style={styles.card}>
        <View style={styles.iconRow}>
          {icons.map((iconName, i) => (
            <Animated.View
              key={iconName}
              style={styles.iconCell}
              entering={
                showIconEntrance
                  ? rm
                    ? FadeIn.duration(160)
                    : FadeInDown.springify()
                        .damping(16)
                        .stiffness(200)
                        .delay(40 + i * 55)
                  : undefined
              }
            >
              <Ionicons name={iconName} size={26} color={theme.accent} />
            </Animated.View>
          ))}
        </View>

        <Text style={styles.title}>{title}</Text>

        <Animated.Text
          key={messages[statusIndex] ?? messages[0]}
          entering={rm ? undefined : FadeIn.duration(180)}
          style={styles.statusLine}
        >
          {messages[statusIndex] ?? messages[0]}
        </Animated.Text>

        {detail ? <Text style={styles.detail}>{detail}</Text> : null}

        <View
          style={styles.track}
          onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        >
          <Animated.View style={[styles.fill, progressFillStyle]} />
        </View>
      </View>
    </View>
  );
}
