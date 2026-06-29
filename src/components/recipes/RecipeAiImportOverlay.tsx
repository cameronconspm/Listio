import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  ZoomIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../design/ThemeContext';
import { recipeActionStackStyle } from '../../design/recipeLayout';
import { PrimaryButton } from '../ui/PrimaryButton';

const PARSING_ICONS = [
  'sparkles',
  'color-wand-outline',
  'reader-outline',
  'restaurant-outline',
  'nutrition-outline',
] as const satisfies readonly (keyof typeof Ionicons.glyphMap)[];

export type RecipeAiImportMode = 'link' | 'paste';
export type RecipeAiImportPhase = 'parsing' | 'success' | 'failure';

export function recipeAiImportStatusMessages(mode: RecipeAiImportMode): readonly string[] {
  if (mode === 'link') {
    return [
      'Fetching the page…',
      'Reading the recipe…',
      'Finding ingredients…',
      'Organizing steps…',
      'Almost there…',
    ] as const;
  }
  return [
    'Reading your recipe…',
    'Finding ingredients…',
    'Organizing steps…',
    'Cleaning up details…',
    'Almost there…',
  ] as const;
}

export function recipeAiImportTitles(mode: RecipeAiImportMode, phase: RecipeAiImportPhase): {
  title: string;
  detail?: string;
} {
  if (phase === 'parsing') {
    return {
      title: mode === 'link' ? 'Importing recipe…' : 'Extracting recipe…',
      detail: 'We’re reading your recipe and pulling out ingredients.',
    };
  }
  if (phase === 'success') {
    return {
      title: mode === 'link' ? 'Recipe imported!' : 'Recipe extracted!',
      detail: 'Review the fields below, then save when you are ready.',
    };
  }
  return {
    title: mode === 'link' ? 'Could not import' : 'Could not extract',
  };
}

type RecipeAiImportOverlayProps = {
  visible: boolean;
  phase: RecipeAiImportPhase;
  mode: RecipeAiImportMode;
  /** When set during `parsing`, drives the progress bar instead of the legacy timed animation. */
  progressFraction?: number;
  errorMessage?: string;
  onDismiss: () => void;
  /** Link import failure: switch the form to paste mode instead of retrying the URL. */
  onTryPaste?: () => void;
  onCancel?: () => void;
  reduceMotion: boolean;
};

/**
 * Full-screen AI recipe import feedback: animated progress while parsing,
 * then success or failure with a single dismiss action.
 */
export function RecipeAiImportOverlay({
  visible,
  phase,
  mode,
  progressFraction,
  errorMessage,
  onDismiss,
  onTryPaste,
  onCancel,
  reduceMotion,
}: RecipeAiImportOverlayProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const rm = useReducedMotion() || reduceMotion;

  const [trackWidth, setTrackWidth] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);
  const progress = useSharedValue(0);

  const statusMessages = useMemo(() => recipeAiImportStatusMessages(mode), [mode]);
  const copy = useMemo(() => recipeAiImportTitles(mode, phase), [mode, phase]);

  useEffect(() => {
    if (!visible || phase !== 'parsing') return;
    setStatusIndex(0);
    if (progressFraction != null) {
      const target = Math.min(1, Math.max(0, progressFraction));
      if (rm) {
        // Reduced motion: snap to milestone, no crawl.
        progress.value = withTiming(target, { duration: 80, easing: Easing.out(Easing.cubic) });
      } else {
        // Jump to the milestone, then crawl forward at a constant velocity
        // so the bar is always visibly moving. Constant velocity (Easing.linear)
        // means it never decelerates to a stop between milestones — the crawl
        // only slows if the operation itself is genuinely stalling.
        const CRAWL_CEIL = 0.95;
        const VELOCITY = 0.028; // progress-units per second
        const crawlMs = Math.round(Math.max(0, (CRAWL_CEIL - target) / VELOCITY) * 1000);
        if (crawlMs > 300 && target < CRAWL_CEIL) {
          progress.value = withSequence(
            withTiming(target, { duration: 220, easing: Easing.out(Easing.cubic) }),
            withTiming(CRAWL_CEIL, { duration: crawlMs, easing: Easing.linear }),
          );
        } else {
          progress.value = withTiming(target, { duration: 220, easing: Easing.out(Easing.cubic) });
        }
      }
      return;
    }
    // No fraction provided: legacy timed full-bar animation.
    progress.value = 0;
    progress.value = withTiming(0.92, {
      duration: rm ? 400 : 11_000,
      easing: Easing.out(Easing.cubic),
    });
  }, [visible, phase, mode, rm, progress, progressFraction]);

  useEffect(() => {
    if (!visible || phase !== 'parsing') return;
    const intervalMs = rm ? 2200 : 1400;
    const id = setInterval(() => {
      setStatusIndex((i) => (i + 1) % statusMessages.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [visible, phase, statusMessages.length, rm]);

  useEffect(() => {
    if (!visible || phase !== 'success') return;
    progress.value = withTiming(1, { duration: rm ? 120 : 320 });
  }, [visible, phase, rm, progress]);

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
          paddingTop: insets.top + theme.spacing.md,
          paddingBottom: insets.bottom + theme.spacing.lg,
        },
        backdrop: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: 'rgba(0,0,0,0.38)',
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
        heroIconWrap: {
          alignSelf: 'center',
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: theme.spacing.md,
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
          marginBottom: theme.spacing.lg,
        },
        fill: {
          height: '100%',
          borderRadius: theme.radius.full,
          backgroundColor: theme.accent,
        },
        errorDetail: {
          ...theme.typography.footnote,
          color: theme.textSecondary,
          textAlign: 'center',
          lineHeight: 20,
          marginBottom: theme.spacing.lg,
        },
        actionStack: recipeActionStackStyle,
      }),
    [theme, insets.top, insets.bottom, windowWidth],
  );

  const cardEntering = rm
    ? FadeIn.duration(220)
    : ZoomIn.springify().damping(17).stiffness(200).mass(0.85);

  const canDismiss = phase === 'success' || phase === 'failure';
  const dismissLabel = phase === 'success' ? 'Continue' : 'Dismiss';
  const showTryPaste = phase === 'failure' && mode === 'link' && onTryPaste != null;

  const heroIcon =
    phase === 'success'
      ? ('checkmark-circle' as const)
      : phase === 'failure'
        ? ('alert-circle-outline' as const)
        : null;

  const heroColor =
    phase === 'success' ? theme.accent : phase === 'failure' ? theme.danger : theme.accent;

  const heroBg =
    phase === 'success'
      ? `${theme.accent}22`
      : phase === 'failure'
        ? `${theme.danger}22`
        : 'transparent';

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      statusBarTranslucent={Platform.OS === 'android'}
      onRequestClose={canDismiss ? onDismiss : undefined}
      accessibilityViewIsModal
    >
      <View
        style={styles.root}
        accessibilityLabel={
          phase === 'parsing'
            ? 'Importing recipe'
            : phase === 'success'
              ? 'Recipe import complete'
              : 'Recipe import failed'
        }
      >
        {canDismiss ? (
          <Pressable
            style={styles.backdrop}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          />
        ) : (
          <View style={styles.backdrop} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
        )}
        <Animated.View entering={cardEntering} style={styles.card}>
          {phase === 'parsing' ? (
            <View style={styles.iconRow}>
              {PARSING_ICONS.map((iconName, i) => (
                <Animated.View
                  key={iconName}
                  style={styles.iconCell}
                  entering={
                    rm
                      ? FadeIn.duration(160)
                      : FadeInDown.springify()
                          .damping(16)
                          .stiffness(200)
                          .delay(40 + i * 55)
                  }
                >
                  <Ionicons name={iconName} size={26} color={theme.accent} />
                </Animated.View>
              ))}
            </View>
          ) : heroIcon ? (
            <View style={[styles.heroIconWrap, { backgroundColor: heroBg }]}>
              <Ionicons name={heroIcon} size={34} color={heroColor} />
            </View>
          ) : null}

          <Text style={styles.title}>{copy.title}</Text>

          {phase === 'parsing' ? (
            <>
              <Animated.Text
                key={statusMessages[statusIndex]}
                entering={rm ? undefined : FadeIn.duration(180)}
                style={styles.statusLine}
              >
                {statusMessages[statusIndex]}
              </Animated.Text>
              <View
                style={styles.track}
                onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
                accessibilityRole="progressbar"
                accessibilityLabel="Import progress"
              >
                <Animated.View style={[styles.fill, progressFillStyle]} />
              </View>
            </>
          ) : null}

          {copy.detail ? <Text style={styles.detail}>{copy.detail}</Text> : null}

          {phase === 'failure' && errorMessage?.trim() ? (
            <Text style={styles.errorDetail}>{errorMessage.trim()}</Text>
          ) : null}

          {phase === 'parsing' && onCancel ? (
            <PrimaryButton title="Cancel" onPress={onCancel} flat style={{ alignSelf: 'stretch' }} />
          ) : null}
          {canDismiss ? (
            <View style={styles.actionStack}>
              {showTryPaste ? (
                <PrimaryButton
                  title="Link didn't work? Try paste"
                  onPress={onTryPaste}
                  style={{ alignSelf: 'stretch' }}
                />
              ) : null}
              <PrimaryButton
                title={dismissLabel}
                onPress={onDismiss}
                flat={showTryPaste}
                style={{ alignSelf: 'stretch' }}
              />
            </View>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}
