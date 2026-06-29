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
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
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
import { horizontalScrollInsetBleed } from '../../design/layout';
import { scaleFontPx, scaleLayoutPx } from '../../design/layoutMetrics';
import { Button } from '../../components/ui/Button';
import { onboardingPageGradient } from '../onboarding/onboardingTokens';
import { useReduceMotion } from '../../ui/motion/useReduceMotion';
import { useHaptics } from '../../hooks/useHaptics';
import { markWelcomeIntroSeen } from '../../services/welcomeIntroService';
import { logFunnelEvent } from '../../services/funnelAnalyticsService';
import { logger } from '../../utils/logger';
import type { AuthStackParamList } from '../../navigation/types';

const LISTIO_ICON = require('../../../assets/icon.png') as number;

/**
 * Pre-auth first-launch welcome. A three-slide carousel previews List, Meals,
 * and Recipes with faux in-app UI. Each slide’s animation runs twice per
 * visit before auto-advance. CTAs route to sign-up or sign-in. Shown once per
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
 * Each card’s intro uses `cycle` from 0→1 twice (two identical eased passes) before
 * the carousel auto-advances. Inactive cards treat `cycle` as 1 so peeking shows the
 * finished frame.
 */
const INTRO_SINGLE_PLAY_MS = 3000;
const INTRO_DOUBLE_CYCLE_MS = INTRO_SINGLE_PLAY_MS * 2;
const INTRO_CYCLE_RESET_DELAY_MS = 120;
const INTRO_PLAY_EASING = Easing.inOut(Easing.cubic);

/** Auto-advance after two full plays of the active card’s choreography. */
const AUTO_ADVANCE_MS = Math.round((INTRO_DOUBLE_CYCLE_MS + 900) * 0.75);
/** After a user-initiated swipe, wait this long before resuming auto-advance so we never fight the user. */
const AUTO_ADVANCE_RESUME_MS = 7000;

/** Legacy tuning constants (fractions below are derived from prior STAGGER_MS/CYCLE_MS timings). */
const STAGGER_MS = 400;
const BEAT_MS = 360;
const LEGACY_CYCLE_MS = STAGGER_MS * 4 + 1400;
/** Normalized timeline length for one play (matches previous `CYCLE_MS`). */
const CYCLE_MS = LEGACY_CYCLE_MS;

type ListChip = { label: string; count?: string; active?: boolean };

const LIST_CHIPS: ListChip[] = [
  { label: 'All', count: '36', active: true },
  { label: 'Produce', count: '9' },
  { label: 'Dairy', count: '6' },
];

type ListZoneRow = {
  label: string;
  subtitle?: string;
  qty: string;
  rowIndex: number;
};

const LIST_ZONE_ROWS: ListZoneRow[] = [
  { label: 'Avocados', subtitle: 'Salads & eggs', qty: '4 ea', rowIndex: 0 },
  { label: 'Baby Carrots', qty: '1 lb', rowIndex: 1 },
  { label: 'Berries', subtitle: 'Mix of colors', qty: '10 oz', rowIndex: 2 },
];

type MealsStripDay = {
  dow: string;
  dom: string;
  selected: boolean;
};

const MEALS_STRIP_DAYS: MealsStripDay[] = [
  { dow: 'Tue', dom: '12', selected: false },
  { dow: 'Wed', dom: '13', selected: false },
  { dow: 'Thu', dom: '14', selected: true },
  { dow: 'Fri', dom: '15', selected: false },
  { dow: 'Sat', dom: '16', selected: false },
];

type MealPlanRowData = {
  slot: string;
  title: string | null;
  detail?: string;
  isAddRow?: boolean;
};

const MEALS_PLAN_ROWS: MealPlanRowData[] = [
  { slot: 'Breakfast', title: 'Greek yogurt power bowl', detail: '2 servings · Breakfast' },
  { slot: 'Lunch', title: 'Sheet-pan lemon salmon', detail: '4 ingredients' },
  { slot: 'Dessert', title: null, isAddRow: true },
];

/** Meal plan rows that animate in with a stagger (filled rows first, then “+ Add”). */
const MEALS_ROW_ANIM_ORDER = [0, 1, 2];

type RecipeIntroCard = {
  title: string;
  favorited: boolean;
  meta: string[];
};

const RECIPE_INTRO_CARDS: RecipeIntroCard[] = [
  { title: 'Berry banana smoothie', favorited: true, meta: ['2 servings', '4 ingredients', 'Snack'] },
  { title: 'Whole wheat pancakes', favorited: false, meta: ['8 servings', '11 ingredients', 'Breakfast'] },
];

type CardKind = 'list' | 'meals' | 'recipes';

type FeatureCardMeta = {
  id: CardKind;
  headerIcon: keyof typeof Ionicons.glyphMap;
  headerText: string;
  caption: string;
};

const CARDS: FeatureCardMeta[] = [
  {
    id: 'list',
    headerIcon: 'list',
    headerText: 'Your list',
    caption: 'Items sort by store aisle automatically. Add in seconds, shop with clarity.',
  },
  {
    id: 'meals',
    headerIcon: 'calendar',
    headerText: 'Shop mode',
    caption: 'Check items off aisle by aisle with a progress bar built for real grocery runs.',
  },
  {
    id: 'recipes',
    headerIcon: 'book',
    headerText: 'Meals & recipes',
    caption: 'Plan the week or save recipes — send ingredients to your list in one tap.',
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
  const scrollRef = useRef<Animated.ScrollView>(null);
  /**
   * Timestamp of the last user-initiated scroll. Auto-advance is suppressed
   * until `Date.now() - lastUserInteractionRef.current > AUTO_ADVANCE_RESUME_MS`.
   */
  const lastUserInteractionRef = useRef(0);
  /** Live horizontal scroll offset, driven on the UI thread for parallax animations. */
  const scrollX = useSharedValue(0);

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
    const onePlay = withTiming(1, {
      duration: INTRO_SINGLE_PLAY_MS,
      easing: INTRO_PLAY_EASING,
    });
    const snapToStart = withTiming(0, { duration: 0 });
    cycle.value = withRepeat(
      withSequence(
        onePlay,
        snapToStart,
        onePlay,
        withDelay(INTRO_CYCLE_RESET_DELAY_MS, snapToStart)
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
      logFunnelEvent('welcome_intro_complete');
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

  const handleSkipIntro = useCallback(() => {
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
  const icon = useMemo(
    () => ({
      xs: scaleLayoutPx(theme.layoutScale, 12),
      sm: scaleLayoutPx(theme.layoutScale, 14),
      md: scaleLayoutPx(theme.layoutScale, 16),
      lg: scaleLayoutPx(theme.layoutScale, 18),
      xl: scaleLayoutPx(theme.layoutScale, 24),
    }),
    [theme.layoutScale],
  );
  /**
   * Carousel card sizing. Cards are intentionally narrower than the screen so the
   * next card peeks clearly at the trailing edge — same feel as featured shelves
   * in the iOS App Store. Scales across iPhone SE → iPad:
   *  - Card width is capped at `cardMaxWidth`; extra width on wide screens turns
   *    into more peek (and centers the first card) instead of stretching cards.
   *  - Per-card scale + opacity animation (see HeroCard) emphasizes the focused
   *    card on any screen size, so the layout reads correctly even on tablets.
   */
  /**
   * `cardNeighborPeek` is the visible portion of the *neighbor* card on each
   * side of the focused (centered) card. With symmetric side padding and a
   * `cardGap` between cards, the geometry works out to:
   *   sidePad   = (windowWidth - cardWidth) / 2
   *   peek/side = sidePad - cardGap
   * So `cardWidth = windowWidth - 2 * (peek + cardGap)`. Solving for cardWidth
   * with a guaranteed minimum peek gives the formula below.
   */
  const cardGap = theme.spacing.md;
  const cardMaxWidth = scaleLayoutPx(theme.layoutScale, 380);
  const cardNeighborPeek = scaleLayoutPx(theme.layoutScale, 40);
  const cardWidth = Math.min(
    Math.max(0, windowWidth - (cardGap + cardNeighborPeek) * 2),
    cardMaxWidth,
  );
  const pageStride = cardWidth + cardGap;
  /**
   * Symmetric side padding so the focused card sits dead-center on screen with
   * equal peek of the neighboring card on either side. Math: when scrollX = N *
   * pageStride, card N's center sits at sidePad + cardWidth/2 in content space,
   * which equals windowWidth/2 in view space → centered.
   */
  const heroSidePad = Math.max(horizontalPadding, (windowWidth - cardWidth) / 2);
  const heroLeadingPad = heroSidePad;
  const heroTrailingPad = heroSidePad;
  const heroSnapOffsets = useMemo(
    () => CARDS.map((_, index) => index * pageStride),
    [pageStride],
  );

  /**
   * Auto-advance the carousel. Respects reduce-motion (no auto), and pauses
   * for `AUTO_ADVANCE_RESUME_MS` whenever the user drags so we never yank the
   * page from under them.
   */
  useEffect(() => {
    if (reduceMotion || pageStride <= 0 || CARDS.length <= 1) return;
    const timer = setTimeout(() => {
      const elapsedSinceUser = Date.now() - lastUserInteractionRef.current;
      if (elapsedSinceUser < AUTO_ADVANCE_RESUME_MS) return;
      const next = (activePage + 1) % CARDS.length;
      scrollRef.current?.scrollTo({ x: next * pageStride, y: 0, animated: true });
    }, AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [activePage, pageStride, reduceMotion]);

  const handleScrollBeginDrag = useCallback(() => {
    lastUserInteractionRef.current = Date.now();
  }, []);

  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pageStride <= 0) return;
      const x = e.nativeEvent.contentOffset.x;
      const page = Math.round(x / pageStride);
      const clamped = Math.max(0, Math.min(CARDS.length - 1, page));
      if (clamped !== activePage) setActivePage(clamped);
    },
    [activePage, pageStride]
  );

  /** UI-thread scroll handler so per-card scale/opacity animations stay at 60fps during drag. */
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const styles = useMemo(
    () =>
      createStyles(theme, {
        insets,
        horizontalPadding,
        isCompactHeight,
        windowWidth,
        windowHeight,
      }),
    [theme, insets, horizontalPadding, isCompactHeight, windowWidth, windowHeight],
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
              <Ionicons name="close" size={icon.lg} color={theme.textPrimary} />
            </Pressable>
          ) : (
            <Pressable
              onPress={handleSkipIntro}
              style={styles.skipButton}
              accessibilityRole="button"
              accessibilityLabel="Skip intro"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[theme.typography.subhead, { color: theme.textSecondary, fontWeight: '600' }]}>
                Skip
              </Text>
            </Pressable>
          )}
        </View>

        <ScrollView
          style={styles.introScroll}
          contentContainerStyle={styles.introScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={styles.heroWrap}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Animated.ScrollView
              ref={scrollRef}
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={scrollHandler}
              onScrollBeginDrag={handleScrollBeginDrag}
              onMomentumScrollEnd={handleMomentumScrollEnd}
              scrollEventThrottle={16}
              decelerationRate="fast"
              snapToOffsets={heroSnapOffsets}
              snapToAlignment="start"
              disableIntervalMomentum
              contentContainerStyle={[
                styles.heroScrollContent,
                { paddingLeft: heroLeadingPad, paddingRight: heroTrailingPad },
              ]}
            >
              {CARDS.map((card, index) => (
                <HeroCard
                  key={card.id}
                  card={card}
                  index={index}
                  width={cardWidth}
                  isLast={index === CARDS.length - 1}
                  gap={cardGap}
                  isActive={index === activePage}
                  cycle={cycle}
                  scrollX={scrollX}
                  pageStride={pageStride}
                  styles={styles}
                  theme={theme}
                  icons={icon}
                />
              ))}
            </Animated.ScrollView>
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
            <Text style={styles.headline}>The beautiful grocery list that knows your store</Text>
            <Text style={styles.sub}>
              Listio sorts your list by aisle, helps you shop with check-off progress, and keeps meals and recipes
              connected when you want them — without copying the same items twice.
            </Text>
          </View>
        </ScrollView>

        <View style={[styles.ctaDock, { paddingBottom: insets.bottom + theme.spacing.md }]}>
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
    </View>
  );
}

// --- Carousel card -------------------------------------------------------

type Styles = ReturnType<typeof createStyles>;

type HeroCardProps = {
  card: FeatureCardMeta;
  index: number;
  width: number;
  isLast: boolean;
  gap: number;
  isActive: boolean;
  cycle: SharedValue<number>;
  scrollX: SharedValue<number>;
  pageStride: number;
  styles: Styles;
  theme: AppTheme;
  icons: IntroIconSizes;
};

/**
 * One slide in the welcome carousel. Renders the per-card header, faux preview
 * panel, and caption. Drives a scroll-tracked scale + opacity animation so the
 * focused card pops while neighbors recede — same visual language as iOS App
 * Store featured shelves.
 */
function HeroCard({
  card,
  index,
  width,
  isLast,
  gap,
  isActive,
  cycle,
  scrollX,
  pageStride,
  styles,
  theme,
  icons,
}: HeroCardProps) {
  const cardAnim = useAnimatedStyle(() => {
    if (pageStride <= 0) return { transform: [{ scale: 1 }], opacity: 1 };
    const dist = Math.abs(scrollX.value / pageStride - index);
    const scale = interpolate(dist, [0, 1], [1, 0.86], Extrapolation.CLAMP);
    const opacity = interpolate(dist, [0, 1], [1, 0.45], Extrapolation.CLAMP);
    return { transform: [{ scale }], opacity };
  });

  return (
    <Animated.View
      style={[
        styles.heroPage,
        { width },
        isLast ? null : { marginRight: gap },
        cardAnim,
      ]}
    >
      <View style={styles.heroHeader}>
        <Ionicons name={card.headerIcon} size={icons.sm} color={theme.accent} />
        <Text style={styles.heroHeaderText}>{card.headerText}</Text>
      </View>
      <View style={styles.heroPreviewPanel}>
        <FeatureCardBody
          kind={card.id}
          isActive={isActive}
          cycle={cycle}
          styles={styles}
          theme={theme}
          icons={icons}
        />
      </View>
      <Text style={styles.caption}>{card.caption}</Text>
    </Animated.View>
  );
}

// --- Card body dispatcher ------------------------------------------------

type IntroIconSizes = {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
};

type CardBodyProps = {
  kind: CardKind;
  isActive: boolean;
  cycle: SharedValue<number>;
  styles: Styles;
  theme: AppTheme;
  icons: IntroIconSizes;
};

function FeatureCardBody({ kind, isActive, cycle, styles, theme, icons }: CardBodyProps) {
  if (kind === 'list') {
    return <ListBody isActive={isActive} cycle={cycle} styles={styles} theme={theme} icons={icons} />;
  }
  if (kind === 'meals') {
    return <MealsBody isActive={isActive} cycle={cycle} styles={styles} theme={theme} icons={icons} />;
  }
  return <RecipesBody isActive={isActive} cycle={cycle} styles={styles} theme={theme} icons={icons} />;
}

// --- List card -----------------------------------------------------------

type ListBodyProps = {
  isActive: boolean;
  cycle: SharedValue<number>;
  styles: Styles;
  theme: AppTheme;
  icons: IntroIconSizes;
};

function ListBody({ isActive, cycle, styles, theme, icons }: ListBodyProps) {
  return (
    <View style={styles.listBody}>
      <View style={[styles.listSegmentRow, { borderColor: theme.divider }]}>
        <View style={[styles.listSegmentSide, { backgroundColor: theme.background }]}>
          <Text style={[styles.listSegmentSideText, { color: theme.textSecondary }]}>Plan</Text>
        </View>
        <View style={[styles.listSegmentSide, { backgroundColor: theme.accent }]}>
          <Text style={[styles.listSegmentSideText, { color: theme.onAccent }]}>Shop</Text>
        </View>
      </View>
      <View style={styles.listChipRow}>
        {LIST_CHIPS.map((chip) => (
          <View
            key={chip.label}
            style={[
              styles.listChip,
              chip.active
                ? { backgroundColor: theme.accent + '22', borderColor: theme.accent }
                : { backgroundColor: theme.background, borderColor: theme.divider },
            ]}
          >
            <Text
              style={[
                styles.listChipText,
                { color: chip.active ? theme.accent : theme.textPrimary },
              ]}
            >
              {chip.label}
              {chip.count ? (
                <Text style={{ color: chip.active ? theme.accent : theme.textSecondary }}>
                  {' '}
                  {chip.count}
                </Text>
              ) : null}
            </Text>
          </View>
        ))}
      </View>
      <Text style={[styles.listMetaLine, { color: theme.textSecondary }]}>
        36 left · 8 sections · Next: Produce
      </Text>
      <View style={[styles.listZoneHeader, { borderColor: theme.accent + '55', backgroundColor: theme.accent + '10' }]}>
        <Ionicons name="leaf-outline" size={icons.md} color={theme.accent} />
        <Text style={[styles.listZoneTitle, { color: theme.accent }]}>Produce</Text>
        <Text style={[styles.listZoneCount, { color: theme.textSecondary }]}>9 left</Text>
        <Ionicons name="chevron-down" size={icons.md} color={theme.textSecondary} style={{ marginLeft: 'auto' }} />
      </View>
      {LIST_ZONE_ROWS.map((row, index) => (
        <ListZoneRowView
          key={row.label}
          row={row}
          index={index}
          isLast={index === LIST_ZONE_ROWS.length - 1}
          isActive={isActive}
          cycle={cycle}
          styles={styles}
          theme={theme}
          icons={icons}
        />
      ))}
    </View>
  );
}

type ListZoneRowViewProps = {
  row: ListZoneRow;
  index: number;
  isLast: boolean;
  isActive: boolean;
  cycle: SharedValue<number>;
  styles: Styles;
  theme: AppTheme;
  icons: IntroIconSizes;
};

function ListZoneRowView({
  row,
  index,
  isLast,
  isActive,
  cycle,
  styles,
  theme,
  icons,
}: ListZoneRowViewProps) {
  /** Rows snap in within the first ~250ms of each cycle so cards never look empty on enter. */
  const rowEnterStart = index * 0.02;
  const rowEnterEnd = rowEnterStart + 0.05;
  const checkStart = 0.44 + index * 0.1;
  const checkEnd = checkStart + 0.09;

  const rowStyle = useAnimatedStyle(() => {
    if (!isActive) return { opacity: 1, transform: [{ translateY: 0 }] };
    const tt = cycle.value;
    const t = interpolate(tt, [rowEnterStart, rowEnterEnd], [0, 1], 'clamp');
    return {
      opacity: t,
      transform: [{ translateY: interpolate(t, [0, 1], [8, 0]) }],
    };
  });

  const ellipseStyle = useAnimatedStyle(() => {
    const tt = !isActive ? 1 : cycle.value;
    const ck = interpolate(tt, [checkStart, checkEnd], [0, 1], 'clamp');
    return { opacity: interpolate(ck, [0, 0.35, 1], [1, 0.2, 0], 'clamp') };
  });

  const checkIconStyle = useAnimatedStyle(() => {
    const tt = !isActive ? 1 : cycle.value;
    const ck = interpolate(tt, [checkStart, checkEnd], [0, 1], 'clamp');
    return {
      opacity: interpolate(ck, [0, 0.45, 1], [0, 0.9, 1], 'clamp'),
      transform: [{ scale: interpolate(ck, [0, 1], [0.65, 1], 'clamp') }],
    };
  });

  const strikeStyle = useAnimatedStyle(() => {
    if (!isActive) return { width: '100%' };
    const tt = cycle.value;
    const ck = interpolate(tt, [checkStart, checkEnd], [0, 1], 'clamp');
    return { width: `${Math.round(ck * 100)}%` };
  });

  const titleColorStyle = useAnimatedStyle(() => {
    const tt = !isActive ? 1 : cycle.value;
    const ck = interpolate(tt, [checkStart, checkEnd], [0, 1], 'clamp');
    return {
      opacity: interpolate(ck, [0, 1], [1, 0.55], 'clamp'),
    };
  });

  return (
    <Animated.View style={[styles.listItemRow, isLast ? styles.heroRowLast : null, rowStyle]}>
      <View style={styles.listToggleCol}>
        <Animated.View style={[styles.listToggleIconLayer, ellipseStyle]}>
          <Ionicons name="ellipse-outline" size={icons.xl} color={theme.textSecondary} />
        </Animated.View>
        <Animated.View style={[styles.listToggleIconLayer, checkIconStyle]}>
          <Ionicons name="checkmark-circle" size={icons.xl} color={theme.accent} />
        </Animated.View>
      </View>
      <View style={styles.listItemTextCol}>
        <View style={styles.shopLabelWrap}>
          <Animated.View style={titleColorStyle}>
            <Text style={[styles.listItemTitle, { color: theme.textPrimary }]} numberOfLines={1}>
              {row.label}
            </Text>
          </Animated.View>
          <Animated.View
            style={[
              styles.shopStrike,
              { backgroundColor: theme.textSecondary },
              strikeStyle,
            ]}
          />
        </View>
        {row.subtitle ? (
          <Text style={[styles.listItemSub, { color: theme.textSecondary }]} numberOfLines={1}>
            {row.subtitle}
          </Text>
        ) : null}
        <View style={styles.listQtyPill}>
          <Text style={[styles.listQtyPillText, { color: theme.textSecondary }]}>{row.qty}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

// --- Meals card ----------------------------------------------------------

type MealsBodyProps = {
  isActive: boolean;
  cycle: SharedValue<number>;
  styles: Styles;
  theme: AppTheme;
  icons: IntroIconSizes;
};

function MealsBody({ isActive, cycle, styles, theme, icons }: MealsBodyProps) {
  return (
    <View style={styles.mealsBody}>
      <View style={styles.mealsStrip}>
        {MEALS_STRIP_DAYS.map((day, index) => (
          <MealsStripCell
            key={`${day.dow}-${day.dom}`}
            day={day}
            index={index}
            isActive={isActive}
            cycle={cycle}
            styles={styles}
            theme={theme}
          />
        ))}
      </View>
      <Text style={[styles.mealsWeekRange, { color: theme.textSecondary }]}>May 11–17 · 7 days</Text>
      <View style={[styles.mealsDayCard, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
        <Text style={[styles.mealsDayCardTitle, { color: theme.textPrimary }]}>Thursday, May 14</Text>
        {MEALS_PLAN_ROWS.map((row, index) => (
          <MealPlanRowView
            key={row.slot}
            row={row}
            animIndex={MEALS_ROW_ANIM_ORDER.indexOf(index)}
            isLast={index === MEALS_PLAN_ROWS.length - 1}
            isActive={isActive}
            cycle={cycle}
            styles={styles}
            theme={theme}
            icons={icons}
          />
        ))}
      </View>
      <MealsFooterChip isActive={isActive} cycle={cycle} styles={styles} theme={theme} icons={icons} />
    </View>
  );
}

type MealsStripCellProps = {
  day: MealsStripDay;
  index: number;
  isActive: boolean;
  cycle: SharedValue<number>;
  styles: Styles;
  theme: AppTheme;
};

function MealsStripCell({ day, index, isActive, cycle, styles, theme }: MealsStripCellProps) {
  const enterStart = (STAGGER_MS * 0.15 * index) / CYCLE_MS;
  const enterEnd = (STAGGER_MS * 0.15 * index + BEAT_MS * 0.45) / CYCLE_MS;

  const cellStyle = useAnimatedStyle(() => {
    if (!isActive) return { opacity: 1, transform: [{ translateY: 0 }] };
    const tt = cycle.value;
    const t = interpolate(tt, [enterStart, enterEnd], [0, 1], 'clamp');
    return {
      opacity: interpolate(t, [0, 1], [0.35, 1]),
      transform: [{ translateY: interpolate(t, [0, 1], [4, 0]) }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.mealsStripCell,
        day.selected ? { backgroundColor: theme.accent + '22', borderColor: theme.accent } : null,
        !day.selected ? { borderColor: theme.divider, backgroundColor: theme.background } : null,
        cellStyle,
      ]}
    >
      <Text
        style={[
          styles.mealsStripDow,
          { color: day.selected ? theme.accent : theme.textSecondary },
        ]}
      >
        {day.dow}
      </Text>
      <Text
        style={[
          styles.mealsStripDom,
          { color: day.selected ? theme.accent : theme.textPrimary },
        ]}
      >
        {day.dom}
      </Text>
    </Animated.View>
  );
}

type MealPlanRowViewProps = {
  row: MealPlanRowData;
  animIndex: number;
  isLast: boolean;
  isActive: boolean;
  cycle: SharedValue<number>;
  styles: Styles;
  theme: AppTheme;
  icons: IntroIconSizes;
};

function MealPlanRowView({
  row,
  animIndex,
  isLast,
  isActive,
  cycle,
  styles,
  theme,
  icons,
}: MealPlanRowViewProps) {
  /** Snappy enter: rows visible within ~200ms of cycle start so the card is never blank on reset. */
  const popStart = animIndex >= 0 ? animIndex * 0.025 : 0;
  const popEnd = animIndex >= 0 ? popStart + 0.05 : 0;

  const rowStyle = useAnimatedStyle(() => {
    if (!isActive) return { opacity: 1, transform: [{ translateY: 0 }] };
    if (animIndex < 0) return { opacity: 1, transform: [{ translateY: 0 }] };
    const tt = cycle.value;
    const t = interpolate(tt, [popStart, popEnd], [0, 1], 'clamp');
    return {
      opacity: t,
      transform: [{ translateY: interpolate(t, [0, 1], [6, 0]) }],
    };
  });

  const addPulseStyle = useAnimatedStyle(() => {
    if (!row.isAddRow) return { opacity: 1 };
    if (!isActive) return { opacity: 1 };
    const tt = cycle.value;
    const pulseStart = (STAGGER_MS * 2.5) / CYCLE_MS;
    const pulseEnd = (STAGGER_MS * 3 + BEAT_MS * 0.5) / CYCLE_MS;
    const t = interpolate(tt, [pulseStart, pulseEnd], [0, 1], 'clamp');
    return { opacity: interpolate(t, [0, 0.5, 1], [1, 0.55, 1]) };
  });

  if (row.isAddRow) {
    return (
      <Animated.View style={[styles.mealPlanRow, isLast ? styles.mealPlanRowLast : null, rowStyle]}>
        <Text style={[styles.mealPlanSlot, { color: theme.textSecondary }]}>{row.slot}</Text>
        <Text style={[styles.mealPlanEmpty, { color: theme.textSecondary }]}>Nothing planned</Text>
        <Animated.View style={addPulseStyle}>
          <View style={[styles.mealPlanAddBtn, { backgroundColor: theme.accent + '18' }]}>
            <Text style={[styles.mealPlanAddBtnText, { color: theme.accent }]}>+ Add</Text>
          </View>
        </Animated.View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.mealPlanRow, isLast ? styles.mealPlanRowLast : null, rowStyle]}>
      <View style={styles.mealPlanRowMain}>
        <Text style={[styles.mealPlanSlot, { color: theme.textSecondary }]}>{row.slot}</Text>
        <Text style={[styles.mealPlanTitle, { color: theme.textPrimary }]} numberOfLines={1}>
          {row.title}
        </Text>
        {row.detail ? (
          <Text style={[styles.mealPlanDetail, { color: theme.textSecondary }]} numberOfLines={1}>
            {row.detail}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={icons.md} color={theme.textSecondary} />
    </Animated.View>
  );
}

type MealsFooterChipProps = {
  isActive: boolean;
  cycle: SharedValue<number>;
  styles: Styles;
  theme: AppTheme;
  icons: IntroIconSizes;
};

function MealsFooterChip({ isActive, cycle, styles, theme, icons }: MealsFooterChipProps) {
  const chipStart = (STAGGER_MS * MEALS_ROW_ANIM_ORDER.length + 40) / CYCLE_MS;
  const chipEnd = (STAGGER_MS * MEALS_ROW_ANIM_ORDER.length + 40 + BEAT_MS) / CYCLE_MS;

  const chipStyle = useAnimatedStyle(() => {
    if (!isActive) return { opacity: 1, transform: [{ translateY: 0 }] };
    const tt = cycle.value;
    const t = interpolate(tt, [chipStart, chipEnd], [0, 1], 'clamp');
    return {
      opacity: t,
      transform: [{ translateY: interpolate(t, [0, 1], [6, 0]) }],
    };
  });

  return (
    <Animated.View style={[styles.mealsFooter, chipStyle]}>
      <Ionicons name="link" size={icons.xs} color={theme.accent} />
      <Text style={styles.mealsFooterText}>Ingredients stay linked to your list</Text>
    </Animated.View>
  );
}

// --- Recipes card --------------------------------------------------------

type RecipesBodyProps = {
  isActive: boolean;
  cycle: SharedValue<number>;
  styles: Styles;
  theme: AppTheme;
  icons: IntroIconSizes;
};

function RecipesBody({ isActive, cycle, styles, theme, icons }: RecipesBodyProps) {
  const chipIconGap = scaleLayoutPx(theme.layoutScale, 4);
  return (
    <View style={styles.recipesBody}>
      <View style={[styles.recipesSearch, { borderColor: theme.divider, backgroundColor: theme.background }]}>
        <Ionicons name="search" size={icons.md} color={theme.textSecondary} />
        <Text style={[styles.recipesSearchPlaceholder, { color: theme.textSecondary }]}>
          Search by name or ingredient
        </Text>
      </View>
      <View style={styles.recipesChipRow}>
        <View style={[styles.recipesFilterChip, { backgroundColor: theme.accent + '22', borderColor: theme.accent }]}>
          <Text style={[styles.recipesFilterChipText, { color: theme.accent }]}>All</Text>
        </View>
        <View style={[styles.recipesFilterChip, { borderColor: theme.divider, backgroundColor: theme.background }]}>
          <Ionicons name="heart" size={icons.xs} color={theme.textSecondary} style={{ marginRight: chipIconGap }} />
          <Text style={[styles.recipesFilterChipText, { color: theme.textPrimary }]}>Favorites</Text>
        </View>
        <View style={[styles.recipesFilterChip, { borderColor: theme.divider, backgroundColor: theme.background }]}>
          <Text style={[styles.recipesFilterChipText, { color: theme.textPrimary }]}>Snack</Text>
        </View>
      </View>
      <Text style={[styles.recipesMeta, { color: theme.textSecondary }]}>8 recipes · Sort: Recently updated</Text>
      {RECIPE_INTRO_CARDS.map((card, index) => (
        <RecipeIntroCardView
          key={card.title}
          card={card}
          index={index}
          isLast={index === RECIPE_INTRO_CARDS.length - 1}
          isActive={isActive}
          cycle={cycle}
          styles={styles}
          theme={theme}
          icons={icons}
        />
      ))}
    </View>
  );
}

type RecipeIntroCardViewProps = {
  card: RecipeIntroCard;
  index: number;
  isLast: boolean;
  isActive: boolean;
  cycle: SharedValue<number>;
  styles: Styles;
  theme: AppTheme;
  icons: IntroIconSizes;
};

function RecipeIntroCardView({
  card,
  index,
  isLast,
  isActive,
  cycle,
  styles,
  theme,
  icons,
}: RecipeIntroCardViewProps) {
  /** Snappy enter: cards visible within ~200ms of cycle start so the card is never blank on reset. */
  const cardEnterStart = index * 0.025;
  const cardEnterEnd = cardEnterStart + 0.05;
  const metaStart = (STAGGER_MS * index + BEAT_MS * 0.55) / CYCLE_MS;
  const metaEnd = (STAGGER_MS * index + BEAT_MS * 1.15) / CYCLE_MS;

  const cardStyle = useAnimatedStyle(() => {
    if (!isActive) return { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] };
    const tt = cycle.value;
    const t = interpolate(tt, [cardEnterStart, cardEnterEnd], [0, 1], 'clamp');
    return {
      opacity: t,
      transform: [
        { translateY: interpolate(t, [0, 1], [10, 0]) },
        { scale: interpolate(t, [0, 1], [0.96, 1]) },
      ],
    };
  });

  const metaStyle = useAnimatedStyle(() => {
    if (!isActive) return { opacity: 1 };
    const tt = cycle.value;
    const t = interpolate(tt, [metaStart, metaEnd], [0, 1], 'clamp');
    return { opacity: t };
  });

  const heartStyle = useAnimatedStyle(() => {
    if (!card.favorited) return { transform: [{ scale: 1 }] };
    if (!isActive) return { transform: [{ scale: 1 }] };
    const tt = cycle.value;
    const h0 = (STAGGER_MS * 2.2) / CYCLE_MS;
    const h1 = (STAGGER_MS * 2.2 + BEAT_MS * 0.45) / CYCLE_MS;
    const s = interpolate(tt, [h0, h1], [1, 1.12], 'clamp');
    return { transform: [{ scale: s }] };
  });

  return (
    <Animated.View
      style={[
        styles.recipeCard,
        { borderColor: theme.divider, backgroundColor: theme.surface },
        isLast ? styles.recipeCardLast : null,
        cardStyle,
      ]}
    >
      <View style={styles.recipeCardTop}>
        <Text style={[styles.recipeCardTitle, { color: theme.textPrimary }]} numberOfLines={2}>
          {card.title}
        </Text>
        <View style={styles.recipeCardActions}>
          {card.favorited ? (
            <Animated.View style={heartStyle}>
              <Ionicons name="heart" size={icons.lg} color={theme.accent} />
            </Animated.View>
          ) : null}
          <Ionicons name="ellipsis-horizontal" size={icons.lg} color={theme.textSecondary} />
        </View>
      </View>
      <Animated.View style={[styles.recipeMetaRow, metaStyle]}>
        {card.meta.map((m) => (
          <View key={m} style={[styles.recipeMetaPill, { backgroundColor: theme.background }]}>
            <Text style={[styles.recipeMetaPillText, { color: theme.textSecondary }]}>{m}</Text>
          </View>
        ))}
      </Animated.View>
    </Animated.View>
  );
}

// --- Styles --------------------------------------------------------------

type StyleArgs = {
  insets: { top: number; bottom: number };
  horizontalPadding: number;
  isCompactHeight: boolean;
  windowWidth: number;
  windowHeight: number;
};

function createStyles(
  theme: AppTheme,
  { insets, horizontalPadding, isCompactHeight, windowWidth, windowHeight }: StyleArgs,
) {
  const lx = (v: number) => scaleLayoutPx(theme.layoutScale, v);
  const fx = (v: number) => scaleFontPx(theme.fontScale, v);
  /** Shorter phones: tighter preview so copy + hero fit above pinned CTAs without crowding. */
  const introTight = windowHeight < 820;
  const introVeryTight = windowHeight < 700;
  /**
   * Density tokens. Cards are intentionally tight — they're a *preview* of the
   * real UI, not the UI itself. Defaults are denser than the screens they
   * mimic so the carousel + copy + CTAs all fit above the keyboard-safe area
   * on regular phones; tight breakpoints shave further for SE-class devices.
   */
  const previewPanelPadding = introVeryTight
    ? theme.spacing.xs
    : introTight
      ? theme.spacing.sm
      : theme.spacing.sm;
  const heroWrapVertical = introVeryTight
    ? theme.spacing.xs
    : introTight
      ? theme.spacing.sm
      : theme.spacing.md;
  const listBodyGap = introTight ? theme.spacing.xs : theme.spacing.xs;
  const listRowPadY = introVeryTight ? theme.spacing.xxs : theme.spacing.xs;
  const copyLineMaxW = Math.min(lx(340), windowWidth - horizontalPadding * 2);
  const mealsFooterMaxW = Math.min(lx(260), windowWidth - horizontalPadding * 2);

  return StyleSheet.create({
    root: { flex: 1 },
    container: {
      flex: 1,
      paddingTop: insets.top + (isCompactHeight ? theme.spacing.md : theme.spacing.lg),
      paddingHorizontal: horizontalPadding,
    },
    // overflow: visible so carousel cards can extend to screen edges (Meals week strip pattern).
    introScroll: {
      flex: 1,
      minHeight: 0,
      overflow: 'visible',
    },
    introScrollContent: {
      flexGrow: 1,
      paddingBottom: theme.spacing.md,
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
    skipButton: {
      minHeight: 44,
      minWidth: 44,
      paddingHorizontal: theme.spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeButton: {
      width: lx(32),
      height: lx(32),
      borderRadius: lx(16),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.divider,
    },
    brandMark: {
      width: lx(28),
      height: lx(28),
      borderRadius: lx(8),
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    brandMarkImage: {
      width: '100%',
      height: '100%',
    },
    brandWordmark: {
      fontSize: fx(18),
      fontWeight: '700',
      letterSpacing: 0.2,
      color: theme.textPrimary,
    },
    heroWrap: {
      paddingVertical: heroWrapVertical,
      ...horizontalScrollInsetBleed(horizontalPadding),
    },
    heroScrollContent: {
      alignItems: 'flex-start',
    },
    heroPage: {
      alignItems: 'stretch',
      justifyContent: 'flex-start',
      paddingTop: theme.spacing.xs,
      paddingBottom: theme.spacing.sm,
    },
    heroHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      marginBottom: introTight ? theme.spacing.xs : theme.spacing.sm,
    },
    heroHeaderText: {
      fontSize: fx(12),
      letterSpacing: 0.8,
      fontWeight: '600',
      textTransform: 'uppercase',
      color: theme.textSecondary,
    },
    /** Grey surface for the faux in-app preview (borderless — carousel cards bleed like list pills). */
    heroPreviewPanel: {
      width: '100%',
      borderRadius: theme.radius.md,
      backgroundColor: theme.surface,
      padding: previewPanelPadding,
      overflow: 'hidden',
    },
    // Shared row chrome (shop list, legacy).
    heroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: listRowPadY,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.divider,
    },
    heroRowLast: {
      borderBottomWidth: 0,
    },
    heroEmoji: {
      fontSize: fx(22),
      width: lx(32),
      textAlign: 'center',
    },
    heroLabel: {
      flex: 1,
      marginLeft: theme.spacing.sm,
      color: theme.textPrimary,
      fontSize: fx(15),
      fontWeight: '500',
    },
    heroChip: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: lx(4),
      borderRadius: theme.radius.full,
    },
    heroChipText: {
      fontSize: fx(11),
      fontWeight: '700',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    caption: {
      textAlign: 'center',
      color: theme.textSecondary,
      fontSize: fx(12),
      marginTop: introTight ? theme.spacing.sm : theme.spacing.md,
      letterSpacing: 0.2,
    },
    // List card.
    listBody: {
      gap: listBodyGap,
    },
    listSegmentRow: {
      flexDirection: 'row',
      borderRadius: theme.radius.full,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.divider,
    },
    listSegmentSide: {
      flex: 1,
      paddingVertical: introVeryTight ? lx(6) : lx(8),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.background,
    },
    listSegmentSideText: {
      fontSize: fx(13),
      fontWeight: '700',
    },
    listChipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: lx(6),
    },
    listChip: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: lx(5),
      borderRadius: theme.radius.full,
      borderWidth: StyleSheet.hairlineWidth,
    },
    listChipText: {
      fontSize: fx(12),
      fontWeight: '600',
    },
    listMetaLine: {
      fontSize: fx(11),
      fontWeight: '600',
      letterSpacing: 0.2,
    },
    listZoneHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      paddingVertical: listRowPadY,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
    },
    listZoneTitle: {
      fontSize: fx(12),
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    listZoneCount: {
      fontSize: fx(12),
      fontWeight: '600',
    },
    listItemRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: listRowPadY,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.divider,
    },
    listToggleCol: {
      width: 44,
      height: 44,
      marginRight: theme.spacing.sm,
      marginTop: lx(2),
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    },
    listToggleIconLayer: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listItemTextCol: {
      flex: 1,
      minWidth: 0,
      gap: lx(4),
    },
    listItemTitle: {
      fontSize: fx(15),
      fontWeight: '600',
    },
    listItemSub: {
      fontSize: fx(12),
      fontWeight: '500',
    },
    listQtyPill: {
      alignSelf: 'flex-start',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: lx(3),
      borderRadius: theme.radius.full,
      backgroundColor: theme.background,
    },
    listQtyPillText: {
      fontSize: fx(11),
      fontWeight: '600',
    },
    // Meals card.
    mealsBody: {
      gap: listBodyGap,
    },
    mealsStrip: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: lx(4),
    },
    mealsStripCell: {
      flex: 1,
      borderRadius: lx(10),
      borderWidth: StyleSheet.hairlineWidth,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: lx(6),
      minHeight: 44,
    },
    mealsStripDow: {
      fontSize: fx(10),
      fontWeight: '700',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    mealsStripDom: {
      fontSize: fx(13),
      fontWeight: '700',
      marginTop: lx(2),
    },
    mealsWeekRange: {
      fontSize: fx(11),
      fontWeight: '600',
      textAlign: 'center',
    },
    mealsDayCard: {
      borderRadius: theme.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: theme.spacing.sm,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.xs,
    },
    mealsDayCardTitle: {
      fontSize: fx(17),
      fontWeight: '700',
      marginBottom: theme.spacing.xs,
    },
    mealPlanRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: listRowPadY,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.divider,
    },
    mealPlanRowLast: {
      borderBottomWidth: 0,
    },
    mealPlanRowMain: {
      flex: 1,
    },
    mealPlanSlot: {
      fontSize: fx(11),
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      marginBottom: lx(2),
      width: lx(76),
    },
    mealPlanTitle: {
      fontSize: fx(14),
      fontWeight: '600',
    },
    mealPlanDetail: {
      fontSize: fx(12),
      marginTop: lx(2),
    },
    mealPlanEmpty: {
      flex: 1,
      fontSize: fx(13),
      fontStyle: 'italic',
    },
    mealPlanAddBtn: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: lx(6),
      borderRadius: theme.radius.full,
    },
    mealPlanAddBtnText: {
      fontSize: fx(13),
      fontWeight: '700',
    },
    mealsFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.xs,
      marginTop: theme.spacing.xs,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      alignSelf: 'center',
      borderRadius: theme.radius.full,
      backgroundColor: theme.accent + '12',
    },
    mealsFooterText: {
      fontSize: fx(11),
      fontWeight: '600',
      color: theme.accent,
      textAlign: 'center',
      maxWidth: mealsFooterMaxW,
    },
    // Recipes card.
    recipesBody: {
      gap: listBodyGap,
    },
    recipesSearch: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: introVeryTight ? lx(7) : lx(10),
      borderRadius: theme.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
    },
    recipesSearchPlaceholder: {
      flex: 1,
      fontSize: fx(14),
    },
    recipesChipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: lx(6),
    },
    recipesFilterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: lx(5),
      borderRadius: theme.radius.full,
      borderWidth: StyleSheet.hairlineWidth,
    },
    recipesFilterChipText: {
      fontSize: fx(12),
      fontWeight: '600',
    },
    recipesMeta: {
      fontSize: fx(11),
      fontWeight: '600',
    },
    recipeCard: {
      borderRadius: theme.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: listRowPadY,
    },
    recipeCardLast: {
      marginBottom: 0,
    },
    recipeCardTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.sm,
    },
    recipeCardTitle: {
      flex: 1,
      fontSize: fx(15),
      fontWeight: '700',
    },
    recipeCardActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    recipeMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: lx(6),
      marginTop: theme.spacing.sm,
    },
    recipeMetaPill: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: lx(4),
      borderRadius: theme.radius.full,
    },
    recipeMetaPillText: {
      fontSize: fx(11),
      fontWeight: '600',
    },
    shopLabelWrap: {
      position: 'relative',
      alignSelf: 'stretch',
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
      marginTop: introTight ? theme.spacing.xs : theme.spacing.sm,
      gap: lx(6),
    },
    dot: {
      width: lx(6),
      height: lx(6),
      borderRadius: lx(3),
      backgroundColor: theme.divider,
    },
    dotActive: {
      width: lx(18),
      backgroundColor: theme.accent,
    },
    copyBlock: {
      alignItems: 'center',
      marginTop: introTight ? theme.spacing.sm : isCompactHeight ? theme.spacing.md : theme.spacing.lg,
    },
    headline: {
      fontSize: fx(isCompactHeight ? 26 : 30),
      lineHeight: fx(isCompactHeight ? 32 : 36),
      fontWeight: '700',
      letterSpacing: -0.4,
      color: theme.textPrimary,
      textAlign: 'center',
    },
    sub: {
      marginTop: theme.spacing.sm,
      fontSize: fx(15),
      lineHeight: fx(22),
      color: theme.textSecondary,
      textAlign: 'center',
      maxWidth: copyLineMaxW,
    },
    ctaDock: {
      paddingTop: theme.spacing.sm,
    },
    ctaWrap: {
      gap: theme.spacing.sm,
    },
    secondary: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.sm,
    },
    secondaryText: {
      fontSize: fx(15),
      fontWeight: '600',
      color: theme.accent,
    },
  });
}
