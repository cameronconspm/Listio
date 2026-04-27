import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
  type SharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { useTheme, type AppTheme } from '../../design/ThemeContext';
import { Button } from '../../components/ui/Button';
import { onboardingPageGradient } from '../onboarding/onboardingTokens';
import { useReduceMotion } from '../../ui/motion/useReduceMotion';
import { useHaptics } from '../../hooks/useHaptics';
import { markWelcomeIntroSeen } from '../../services/welcomeIntroService';
import { logger } from '../../utils/logger';
import type { AuthStackParamList } from '../../navigation/types';

const LISTIO_ICON = require('../../../assets/icon.png') as number;

/**
 * Pre-auth first-launch welcome. An auto-advancing carousel highlights three
 * distinct feature stories — AI categorization, meal planning, and
 * aisle-order shop mode — each with its own visual and animation. The CTA
 * row below routes the user into create-account or sign-in. Shown once per
 * install — see `welcomeIntroService`.
 */

type Nav = NativeStackNavigationProp<AuthStackParamList, 'WelcomeIntro'>;

export type WelcomeIntroScreenProps = {
  /**
   * Preview mode: skips persisting the "seen" flag and invokes `onPreviewDismiss`
   * for either CTA so testers can replay the intro from Settings without
   * touching their current auth state. The close (✕) affordance in the top-right
   * is only shown in preview mode.
   */
  preview?: boolean;
  /** Called when any CTA or the ✕ is tapped while `preview` is true. */
  onPreviewDismiss?: () => void;
};

/**
 * Shared beat lengths. Each card has its own choreography, but they all
 * follow the same ~520ms stagger so the three stories feel like variants
 * of a single idea.
 */
const STAGGER_MS = 520;
const BEAT_MS = 420;
const HOLD_MS = 1600;
const CYCLE_MS = STAGGER_MS * 3 + HOLD_MS;

/** Auto-advance to next feature card every N ms. Paused while the user is dragging. */
const AUTO_ADVANCE_MS = 5200;
/** After a user-initiated swipe, wait this long before resuming auto-advance so we never fight the user. */
const AUTO_ADVANCE_RESUME_MS = 7000;

type SortRow = {
  emoji: string;
  label: string;
  aisle: string;
  tint: string;
  tintText: string;
};

type MealsDay = {
  label: string;
  /** Short meal label shown inside filled day cells. `null` means the day has no meal planned. */
  meal: string | null;
};

type ShopItem = {
  label: string;
  aisle: string;
  tint: string;
  tintText: string;
  /** How far through the cycle (0-1) this item should flip to "checked". `null` means it stays unchecked. */
  checkProgress: number | null;
};

const SORT_ROWS: SortRow[] = [
  { emoji: '🥛', label: 'A gallon of milk', aisle: 'Dairy', tint: '#DCEEFB', tintText: '#0F4C81' },
  { emoji: '🥕', label: 'Rainbow carrots', aisle: 'Produce', tint: '#E3F4DC', tintText: '#2F6B2F' },
  { emoji: '🍞', label: 'Sourdough loaf', aisle: 'Bakery', tint: '#FBE8D1', tintText: '#8A4B10' },
];

const MEALS_DAYS: MealsDay[] = [
  { label: 'M', meal: 'Pasta' },
  { label: 'T', meal: null },
  { label: 'W', meal: 'Salmon' },
  { label: 'T', meal: null },
  { label: 'F', meal: 'Tacos' },
  { label: 'S', meal: null },
  { label: 'S', meal: null },
];

/** Indexes of `MEALS_DAYS` that actually have a meal, animated in order of these entries. */
const MEALS_POP_ORDER = [0, 2, 4];

const SHOP_ITEMS: ShopItem[] = [
  {
    label: 'Bananas · 5',
    aisle: 'Produce',
    tint: '#E3F4DC',
    tintText: '#2F6B2F',
    checkProgress: (STAGGER_MS * 0 + BEAT_MS) / CYCLE_MS,
  },
  {
    label: 'Greek yogurt',
    aisle: 'Dairy',
    tint: '#DCEEFB',
    tintText: '#0F4C81',
    checkProgress: (STAGGER_MS * 1 + BEAT_MS) / CYCLE_MS,
  },
  {
    label: 'Sourdough loaf',
    aisle: 'Bakery',
    tint: '#FBE8D1',
    tintText: '#8A4B10',
    checkProgress: null,
  },
];

type CardKind = 'sort' | 'meals' | 'shop';

type FeatureCardMeta = {
  id: CardKind;
  headerIcon: keyof typeof Ionicons.glyphMap;
  headerText: string;
  caption: string;
};

const CARDS: FeatureCardMeta[] = [
  {
    id: 'sort',
    headerIcon: 'sparkles',
    headerText: 'Sorting your list…',
    caption: 'Type anything — Listio files it in the right aisle.',
  },
  {
    id: 'meals',
    headerIcon: 'calendar',
    headerText: 'This week',
    caption: 'Plan meals. Your list fills itself.',
  },
  {
    id: 'shop',
    headerIcon: 'bag-check',
    headerText: 'Shopping — aisle 2',
    caption: 'Walk the store in order. Nothing missed.',
  },
];

export function WelcomeIntroScreen({ preview = false, onPreviewDismiss }: WelcomeIntroScreenProps = {}) {
  const theme = useTheme();
  // Preview renders outside the auth stack (e.g. as a Settings modal), so
  // `useNavigation` may not be connected to AuthStack. We only consume it
  // in the non-preview (real) path.
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const haptics = useHaptics();
  const isDark = theme.colorScheme === 'dark';
  const gradientColors = isDark ? onboardingPageGradient.dark : onboardingPageGradient.light;
  const navigatingRef = useRef(false);

  const [activePage, setActivePage] = useState(0);
  const scrollRef = useRef<ScrollView | null>(null);
  /**
   * Timestamp of the last user-initiated scroll. Auto-advance is suppressed
   * until `Date.now() - lastUserInteractionRef.current > AUTO_ADVANCE_RESUME_MS`.
   */
  const lastUserInteractionRef = useRef(0);

  /**
   * Single animation driver for whichever card is currently active. Inactive
   * cards ignore this value and render in their "final" state so peeking
   * mid-swipe reveals a complete card, not an empty one.
   */
  const cycle = useSharedValue(0);

  /** Kick off the active card's reveal. Restarts whenever the user (or auto-advance) lands on a new page. */
  useEffect(() => {
    cancelAnimation(cycle);
    if (reduceMotion) {
      cycle.value = 1;
      return;
    }
    cycle.value = 0;
    cycle.value = withRepeat(
      withSequence(
        withTiming(1, { duration: CYCLE_MS, easing: Easing.inOut(Easing.cubic) }),
        withDelay(120, withTiming(0, { duration: 0 }))
      ),
      -1,
      false
    );
    return () => cancelAnimation(cycle);
  }, [activePage, reduceMotion, cycle]);

  const navigateToAuth = useCallback(
    (target: 'Signup' | 'Login') => {
      if (navigatingRef.current) return;
      navigatingRef.current = true;
      void markWelcomeIntroSeen().catch((e) => {
        if (__DEV__) logger.warn('WelcomeIntroScreen: markWelcomeIntroSeen failed', e);
      });
      navigation.replace(target);
    },
    [navigation]
  );

  const handlePreviewDismiss = useCallback(() => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    onPreviewDismiss?.();
  }, [onPreviewDismiss]);

  const handleCreateAccount = useCallback(() => {
    haptics.light();
    if (preview) {
      handlePreviewDismiss();
      return;
    }
    navigateToAuth('Signup');
  }, [haptics, preview, handlePreviewDismiss, navigateToAuth]);

  const handleAlreadyHaveAccount = useCallback(() => {
    haptics.light();
    if (preview) {
      handlePreviewDismiss();
      return;
    }
    navigateToAuth('Login');
  }, [haptics, preview, handlePreviewDismiss, navigateToAuth]);

  const handleClosePreview = useCallback(() => {
    haptics.light();
    handlePreviewDismiss();
  }, [haptics, handlePreviewDismiss]);

  /**
   * Tighter vertical padding on short devices (SE-class) so the hero + copy +
   * buttons never need to scroll.
   */
  const isCompactHeight = windowHeight < 720;
  const horizontalPadding = theme.spacing.lg;
  /**
   * Each paging page spans the full ScrollView width (which is also the full
   * window width because `heroWrap` is rendered full-bleed). The card inside
   * the page is then centered via page-level horizontal padding so paging
   * snaps cleanly to a perfectly-centered card regardless of page index.
   */
  const pageWidth = windowWidth;

  /**
   * Auto-advance the carousel. Respects reduce-motion (no auto), and pauses
   * for `AUTO_ADVANCE_RESUME_MS` whenever the user drags so we never yank the
   * page from under them.
   */
  useEffect(() => {
    if (reduceMotion || pageWidth <= 0 || CARDS.length <= 1) return;
    const timer = setTimeout(() => {
      const elapsedSinceUser = Date.now() - lastUserInteractionRef.current;
      if (elapsedSinceUser < AUTO_ADVANCE_RESUME_MS) return;
      const next = (activePage + 1) % CARDS.length;
      scrollRef.current?.scrollTo({ x: next * pageWidth, y: 0, animated: true });
    }, AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [activePage, pageWidth, reduceMotion]);

  const handleScrollBeginDrag = useCallback(() => {
    lastUserInteractionRef.current = Date.now();
  }, []);

  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pageWidth <= 0) return;
      const x = e.nativeEvent.contentOffset.x;
      const page = Math.round(x / pageWidth);
      const clamped = Math.max(0, Math.min(CARDS.length - 1, page));
      if (clamped !== activePage) setActivePage(clamped);
    },
    [activePage, pageWidth]
  );

  const styles = useMemo(
    () => createStyles(theme, { insets, horizontalPadding, isCompactHeight }),
    [theme, insets, horizontalPadding, isCompactHeight]
  );

  return (
    <View style={styles.root}>
      <LinearGradient colors={[...gradientColors]} style={StyleSheet.absoluteFillObject} />
      <View style={styles.container}>
        <View style={styles.topRow}>
          <View style={styles.brandRow} accessibilityRole="header">
            <View style={styles.brandMark}>
              <Image source={LISTIO_ICON} style={styles.brandMarkImage} resizeMode="cover" />
            </View>
            <Text style={styles.brandWordmark}>Listio</Text>
          </View>
          {preview ? (
            <Pressable
              onPress={handleClosePreview}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close intro preview"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={18} color={theme.textPrimary} />
            </Pressable>
          ) : null}
        </View>

        <View
          style={styles.heroWrap}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScrollBeginDrag={handleScrollBeginDrag}
            onMomentumScrollEnd={handleMomentumScrollEnd}
            scrollEventThrottle={16}
            decelerationRate="fast"
          >
            {CARDS.map((card, index) => (
              <View key={card.id} style={[styles.heroPage, { width: pageWidth }]}>
                <View style={styles.heroCard}>
                  <View style={styles.heroHeader}>
                    <Ionicons name={card.headerIcon} size={14} color={theme.accent} />
                    <Text style={styles.heroHeaderText}>{card.headerText}</Text>
                  </View>
                  <FeatureCardBody
                    kind={card.id}
                    isActive={index === activePage}
                    cycle={cycle}
                    styles={styles}
                    theme={theme}
                  />
                  <Text style={styles.caption}>{card.caption}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
          <View
            style={styles.dotsRow}
            accessibilityRole="tablist"
            accessibilityLabel={`Feature ${activePage + 1} of ${CARDS.length}`}
          >
            {CARDS.map((card, index) => (
              <View
                key={card.id}
                style={[styles.dot, index === activePage ? styles.dotActive : null]}
              />
            ))}
          </View>
        </View>

        <View style={styles.copyBlock}>
          <Text style={styles.headline}>Shopping that plans itself.</Text>
          <Text style={styles.sub}>
            Plan meals, send recipes to your list, and shop aisle by aisle. Listio keeps it all
            organized so nothing gets missed.
          </Text>
        </View>

        <View style={styles.ctaWrap}>
          <Button title="Create account" onPress={handleCreateAccount} />
          <Pressable
            onPress={handleAlreadyHaveAccount}
            style={styles.secondary}
            accessibilityRole="button"
            accessibilityLabel="I already have an account"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.secondaryText}>I already have an account</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// --- Card body dispatcher ------------------------------------------------

type Styles = ReturnType<typeof createStyles>;

type CardBodyProps = {
  kind: CardKind;
  isActive: boolean;
  cycle: SharedValue<number>;
  styles: Styles;
  theme: AppTheme;
};

function FeatureCardBody({ kind, isActive, cycle, styles, theme }: CardBodyProps) {
  if (kind === 'sort') {
    return <SortBody isActive={isActive} cycle={cycle} styles={styles} />;
  }
  if (kind === 'meals') {
    return <MealsBody isActive={isActive} cycle={cycle} styles={styles} theme={theme} />;
  }
  return <ShopBody isActive={isActive} cycle={cycle} styles={styles} theme={theme} />;
}

// --- Sort card -----------------------------------------------------------

type SortBodyProps = { isActive: boolean; cycle: SharedValue<number>; styles: Styles };

function SortBody({ isActive, cycle, styles }: SortBodyProps) {
  return (
    <View>
      {SORT_ROWS.map((row, index) => (
        <SortRowView
          key={row.aisle}
          row={row}
          index={index}
          isLast={index === SORT_ROWS.length - 1}
          isActive={isActive}
          cycle={cycle}
          styles={styles}
        />
      ))}
    </View>
  );
}

type SortRowViewProps = {
  row: SortRow;
  index: number;
  isLast: boolean;
  isActive: boolean;
  cycle: SharedValue<number>;
  styles: Styles;
};

function SortRowView({ row, index, isLast, isActive, cycle, styles }: SortRowViewProps) {
  const rowEnterStart = (STAGGER_MS * index) / CYCLE_MS;
  const rowEnterEnd = (STAGGER_MS * index + BEAT_MS) / CYCLE_MS;
  const chipEnterStart = (STAGGER_MS * index + 220) / CYCLE_MS;
  const chipEnterEnd = (STAGGER_MS * index + 220 + BEAT_MS) / CYCLE_MS;

  const rowStyle = useAnimatedStyle(() => {
    if (!isActive) return { opacity: 1, transform: [{ translateY: 0 }] };
    const p = cycle.value;
    const t = interpolate(p, [rowEnterStart, rowEnterEnd], [0, 1], 'clamp');
    return {
      opacity: t,
      transform: [{ translateY: interpolate(t, [0, 1], [8, 0]) }],
    };
  });

  const chipStyle = useAnimatedStyle(() => {
    if (!isActive) return { opacity: 1, transform: [{ scale: 1 }] };
    const p = cycle.value;
    const t = interpolate(p, [chipEnterStart, chipEnterEnd], [0, 1], 'clamp');
    return {
      opacity: t,
      transform: [{ scale: interpolate(t, [0, 1], [0.8, 1]) }],
    };
  });

  return (
    <Animated.View style={[styles.heroRow, isLast ? styles.heroRowLast : null, rowStyle]}>
      <Text style={styles.heroEmoji}>{row.emoji}</Text>
      <Text style={styles.heroLabel} numberOfLines={1}>
        {row.label}
      </Text>
      <Animated.View style={[styles.heroChip, { backgroundColor: row.tint }, chipStyle]}>
        <Text style={[styles.heroChipText, { color: row.tintText }]}>{row.aisle}</Text>
      </Animated.View>
    </Animated.View>
  );
}

// --- Meals card ----------------------------------------------------------

type MealsBodyProps = {
  isActive: boolean;
  cycle: SharedValue<number>;
  styles: Styles;
  theme: AppTheme;
};

function MealsBody({ isActive, cycle, styles, theme }: MealsBodyProps) {
  return (
    <View style={styles.mealsBody}>
      <View style={styles.mealsStrip}>
        {MEALS_DAYS.map((day, index) => (
          <MealsDayCell
            key={`${day.label}-${index}`}
            day={day}
            dayIndex={index}
            isActive={isActive}
            cycle={cycle}
            styles={styles}
          />
        ))}
      </View>
      <MealsFooterChip isActive={isActive} cycle={cycle} styles={styles} theme={theme} />
    </View>
  );
}

type MealsDayCellProps = {
  day: MealsDay;
  dayIndex: number;
  isActive: boolean;
  cycle: SharedValue<number>;
  styles: Styles;
};

function MealsDayCell({ day, dayIndex, isActive, cycle, styles }: MealsDayCellProps) {
  /**
   * Day cells with meals pop in on their shared beat; empty days are just
   * decorative placeholders that don't animate.
   */
  const popIndex = MEALS_POP_ORDER.indexOf(dayIndex);
  const hasMeal = day.meal !== null;
  const popStart = popIndex >= 0 ? (STAGGER_MS * popIndex) / CYCLE_MS : 0;
  const popEnd = popIndex >= 0 ? (STAGGER_MS * popIndex + BEAT_MS) / CYCLE_MS : 0;

  const mealStyle = useAnimatedStyle(() => {
    if (!hasMeal) return { opacity: 0, transform: [{ scale: 0.8 }] };
    if (!isActive) return { opacity: 1, transform: [{ scale: 1 }] };
    const p = cycle.value;
    const t = interpolate(p, [popStart, popEnd], [0, 1], 'clamp');
    return {
      opacity: t,
      transform: [{ scale: interpolate(t, [0, 1], [0.6, 1]) }],
    };
  });

  return (
    <View style={[styles.mealsCell, hasMeal ? styles.mealsCellFilled : null]}>
      <Text style={styles.mealsDayLabel}>{day.label}</Text>
      <Animated.View style={[styles.mealsMealWrap, mealStyle]}>
        {day.meal ? (
          <Text style={styles.mealsMealText} numberOfLines={1}>
            {day.meal}
          </Text>
        ) : null}
      </Animated.View>
    </View>
  );
}

type MealsFooterChipProps = {
  isActive: boolean;
  cycle: SharedValue<number>;
  styles: Styles;
  theme: AppTheme;
};

function MealsFooterChip({ isActive, cycle, styles, theme }: MealsFooterChipProps) {
  /** Appears after the last meal emoji has popped in. */
  const chipStart = (STAGGER_MS * 3 + 60) / CYCLE_MS;
  const chipEnd = (STAGGER_MS * 3 + 60 + BEAT_MS) / CYCLE_MS;

  const chipStyle = useAnimatedStyle(() => {
    if (!isActive) return { opacity: 1, transform: [{ translateY: 0 }] };
    const p = cycle.value;
    const t = interpolate(p, [chipStart, chipEnd], [0, 1], 'clamp');
    return {
      opacity: t,
      transform: [{ translateY: interpolate(t, [0, 1], [6, 0]) }],
    };
  });

  return (
    <Animated.View style={[styles.mealsFooter, chipStyle]}>
      <Ionicons name="sparkles" size={12} color={theme.accent} />
      <Text style={styles.mealsFooterText}>19 ingredients added to your list</Text>
    </Animated.View>
  );
}

// --- Shop card -----------------------------------------------------------

type ShopBodyProps = {
  isActive: boolean;
  cycle: SharedValue<number>;
  styles: Styles;
  theme: AppTheme;
};

function ShopBody({ isActive, cycle, styles, theme }: ShopBodyProps) {
  /**
   * Progress bar fills alongside the item checks so the whole card reads as
   * one coordinated "making progress down the aisle" beat.
   */
  const progressStyle = useAnimatedStyle(() => {
    if (!isActive) return { width: '65%' };
    const p = cycle.value;
    const fillEnd = (STAGGER_MS * 2 + BEAT_MS) / CYCLE_MS;
    const t = interpolate(p, [0, fillEnd], [0, 0.65], 'clamp');
    return { width: `${Math.round(t * 100)}%` };
  });

  return (
    <View style={styles.shopBody}>
      <View style={styles.shopProgressTrack}>
        <Animated.View style={[styles.shopProgressFill, { backgroundColor: theme.accent }, progressStyle]} />
      </View>
      <Text style={styles.shopProgressLabel}>2 of 3 picked up</Text>
      {SHOP_ITEMS.map((item, index) => (
        <ShopItemRow
          key={item.label}
          item={item}
          index={index}
          isLast={index === SHOP_ITEMS.length - 1}
          isActive={isActive}
          cycle={cycle}
          styles={styles}
          theme={theme}
        />
      ))}
    </View>
  );
}

type ShopItemRowProps = {
  item: ShopItem;
  index: number;
  isLast: boolean;
  isActive: boolean;
  cycle: SharedValue<number>;
  styles: Styles;
  theme: AppTheme;
};

function ShopItemRow({ item, index, isLast, isActive, cycle, styles, theme }: ShopItemRowProps) {
  const rowEnterStart = (STAGGER_MS * index) / CYCLE_MS;
  const rowEnterEnd = (STAGGER_MS * index + BEAT_MS) / CYCLE_MS;
  const checkAt = item.checkProgress;
  /** The strike line grows after the row itself has settled. */
  const strikeStart = checkAt ?? 0;
  const strikeEnd = checkAt !== null ? checkAt + BEAT_MS / CYCLE_MS : 0;

  const rowStyle = useAnimatedStyle(() => {
    if (!isActive) return { opacity: 1, transform: [{ translateY: 0 }] };
    const p = cycle.value;
    const t = interpolate(p, [rowEnterStart, rowEnterEnd], [0, 1], 'clamp');
    return {
      opacity: t,
      transform: [{ translateY: interpolate(t, [0, 1], [8, 0]) }],
    };
  });

  const checkStyle = useAnimatedStyle(() => {
    if (checkAt === null) return { opacity: 0, transform: [{ scale: 0.6 }] };
    if (!isActive) return { opacity: 1, transform: [{ scale: 1 }] };
    const p = cycle.value;
    const t = interpolate(p, [strikeStart, strikeEnd], [0, 1], 'clamp');
    return {
      opacity: t,
      transform: [{ scale: interpolate(t, [0, 1], [0.6, 1]) }],
    };
  });

  const strikeStyle = useAnimatedStyle(() => {
    if (checkAt === null) return { width: '0%' };
    if (!isActive) return { width: '100%' };
    const p = cycle.value;
    const t = interpolate(p, [strikeStart, strikeEnd], [0, 1], 'clamp');
    return { width: `${Math.round(t * 100)}%` };
  });

  const labelColor = checkAt !== null ? theme.textSecondary : theme.textPrimary;

  return (
    <Animated.View style={[styles.shopItemRow, isLast ? styles.heroRowLast : null, rowStyle]}>
      <View style={styles.shopCheckbox}>
        <Animated.View style={checkStyle}>
          <Ionicons name="checkmark" size={14} color={theme.accent} />
        </Animated.View>
      </View>
      <View style={styles.shopLabelWrap}>
        <Text style={[styles.shopLabel, { color: labelColor }]} numberOfLines={1}>
          {item.label}
        </Text>
        <Animated.View
          style={[
            styles.shopStrike,
            { backgroundColor: theme.textSecondary },
            strikeStyle,
          ]}
        />
      </View>
      <View style={[styles.heroChip, { backgroundColor: item.tint }]}>
        <Text style={[styles.heroChipText, { color: item.tintText }]}>{item.aisle}</Text>
      </View>
    </Animated.View>
  );
}

// --- Styles --------------------------------------------------------------

type StyleArgs = {
  insets: { top: number; bottom: number };
  horizontalPadding: number;
  isCompactHeight: boolean;
};

function createStyles(theme: AppTheme, { insets, horizontalPadding, isCompactHeight }: StyleArgs) {
  return StyleSheet.create({
    root: { flex: 1 },
    container: {
      flex: 1,
      paddingTop: insets.top + (isCompactHeight ? theme.spacing.md : theme.spacing.lg),
      paddingBottom: insets.bottom + theme.spacing.lg,
      paddingHorizontal: horizontalPadding,
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.divider,
    },
    brandMark: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    brandMarkImage: {
      width: '100%',
      height: '100%',
    },
    brandWordmark: {
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: 0.2,
      color: theme.textPrimary,
    },
    heroWrap: {
      flex: 1,
      justifyContent: 'center',
      paddingVertical: isCompactHeight ? theme.spacing.md : theme.spacing.lg,
      marginHorizontal: -horizontalPadding,
    },
    heroPage: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: horizontalPadding,
    },
    heroCard: {
      width: '100%',
      maxWidth: 360,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.divider,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      ...theme.shadows.floating,
    },
    heroHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      marginBottom: theme.spacing.sm,
    },
    heroHeaderText: {
      fontSize: 12,
      letterSpacing: 0.8,
      fontWeight: '600',
      textTransform: 'uppercase',
      color: theme.textSecondary,
    },
    // Sort card rows — also reused by the Shop card's row frame.
    heroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.divider,
    },
    heroRowLast: {
      borderBottomWidth: 0,
    },
    heroEmoji: {
      fontSize: 22,
      width: 32,
      textAlign: 'center',
    },
    heroLabel: {
      flex: 1,
      marginLeft: theme.spacing.sm,
      color: theme.textPrimary,
      fontSize: 15,
      fontWeight: '500',
    },
    heroChip: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 4,
      borderRadius: theme.radius.full,
    },
    heroChipText: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    caption: {
      textAlign: 'center',
      color: theme.textSecondary,
      fontSize: 12,
      marginTop: theme.spacing.md,
      letterSpacing: 0.2,
    },
    // Meals card.
    mealsBody: {
      paddingVertical: theme.spacing.xs,
    },
    mealsStrip: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 4,
    },
    mealsCell: {
      flex: 1,
      aspectRatio: 0.9,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.divider,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 6,
      backgroundColor: theme.background,
    },
    mealsCellFilled: {
      backgroundColor: theme.accent + '12',
      borderColor: theme.accent + '33',
    },
    mealsDayLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.6,
      color: theme.textSecondary,
      textTransform: 'uppercase',
    },
    mealsMealWrap: {
      marginTop: 4,
      minHeight: 16,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 2,
    },
    mealsMealText: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.accent,
    },
    mealsFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.xs,
      marginTop: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      alignSelf: 'center',
      borderRadius: theme.radius.full,
      backgroundColor: theme.accent + '12',
    },
    mealsFooterText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.accent,
    },
    // Shop card.
    shopBody: {
      paddingTop: 2,
    },
    shopProgressTrack: {
      width: '100%',
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.divider,
      overflow: 'hidden',
    },
    shopProgressFill: {
      height: '100%',
      borderRadius: 3,
    },
    shopProgressLabel: {
      marginTop: 6,
      fontSize: 11,
      fontWeight: '600',
      color: theme.textSecondary,
      letterSpacing: 0.2,
    },
    shopItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.divider,
    },
    shopCheckbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: theme.spacing.sm,
    },
    shopLabelWrap: {
      flex: 1,
      justifyContent: 'center',
      position: 'relative',
    },
    shopLabel: {
      fontSize: 15,
      fontWeight: '500',
    },
    shopStrike: {
      position: 'absolute',
      left: 0,
      height: 1.25,
      top: '50%',
      opacity: 0.8,
    },
    // Dots + copy + CTAs.
    dotsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: theme.spacing.sm,
      gap: 6,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.divider,
    },
    dotActive: {
      width: 18,
      backgroundColor: theme.accent,
    },
    copyBlock: {
      alignItems: 'center',
      marginTop: isCompactHeight ? theme.spacing.md : theme.spacing.lg,
    },
    headline: {
      fontSize: isCompactHeight ? 26 : 30,
      lineHeight: isCompactHeight ? 32 : 36,
      fontWeight: '700',
      letterSpacing: -0.4,
      color: theme.textPrimary,
      textAlign: 'center',
    },
    sub: {
      marginTop: theme.spacing.sm,
      fontSize: 15,
      lineHeight: 22,
      color: theme.textSecondary,
      textAlign: 'center',
      maxWidth: 340,
    },
    ctaWrap: {
      marginTop: isCompactHeight ? theme.spacing.md : theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    secondary: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.sm,
    },
    secondaryText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.accent,
    },
  });
}
