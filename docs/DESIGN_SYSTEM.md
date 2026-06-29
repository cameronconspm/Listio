# Listio Design System

> **Maintenance:** When adding or changing design tokens, shared UI components, motion presets, or visual patterns, update this document in the same PR.

Listio uses an **iOS-first, Apple HIG–aligned** visual language with a **Liquid Glass** aesthetic: frosted surfaces, restrained shadows, warm neutrals, and a green accent. Display titles use **Plus Jakarta Sans**; body and UI text use the **system font**.

See also: [Apple HIG rule](../.cursor/rules/apple-hig.mdc) (spacing, touch targets, sheets).

---

## Source of truth

| Area | Path | Notes |
|------|------|-------|
| Color tokens | `src/design/tokens.ts` | Semantic keys; light/dark values |
| Theme builder | `src/design/theme.ts` | Maps scheme → token set |
| Theme hook | `src/design/ThemeContext.tsx` | `useTheme()`, `useThemeColor()`, `useThemePreference()` |
| Preferred import | `src/hooks/useTheme.ts` | Re-exports `useTheme` / `useThemeColor` |
| Typography | `src/design/typography.ts` | iOS-style type scale |
| Spacing | `src/design/spacing.ts` | 8pt-based rhythm |
| Radius | `src/design/radius.ts` | Cards, inputs, sheets |
| Shadows | `src/design/shadows.ts` | Depth tiers |
| Layout scaling | `src/design/layoutMetrics.ts` | Responsive scale from reference width |
| Layout helpers | `src/design/layout.ts` | Tab header heights, scroll insets |
| Recipe layout | `src/design/recipeLayout.ts` | Shared recipe screen spacing presets |
| Fonts | `src/design/fonts.ts` | Plus Jakarta Sans assets |
| Motion | `src/ui/motion/` | Durations, easing, springs (prefer over `src/design/motion.ts` re-export) |
| Navigation chrome | `src/ui/chrome/` | Header/tab bar blur and tint |
| Shared UI | `src/components/ui/` | Buttons, rows, sheets, cards, fields |
| UI primitives | `src/ui/components/` | ModalSheet, SegmentedPillControl, PressableScale, AlertDialog, PopoverMenu |
| Zone colors | `src/data/zoneColors.ts` | Per-aisle accent palette |
| Zone metadata | `src/data/zone.ts` | Labels, icons, keys |
| Onboarding layout | `src/screens/onboarding/onboardingTokens.ts` | Onboarding spacing and gradients |
| Token export | `npm run tokens:export` | Writes `design-tokens.tokens.json` for design tools |

**Always consume tokens through `useTheme()`** in components — not raw imports from `spacing.ts` / `typography.ts` (except static StyleSheet defaults, domain layout factories, or tests). `useTheme()` returns **scaled** spacing, radius, typography, and shadows based on window width.

**Re-export pattern:** Several `src/components/ui/` files re-export primitives from `src/ui/components/` (e.g. `PressableScale`, `AnchoredMenu` → `PopoverMenu`). Import from `components/ui/` in feature code unless you are extending the primitive itself.

---

## Design principles

1. **Apple-like hierarchy** — Large titles for hero moments; body for content; footnote/subhead for labels and metadata.
2. **Liquid Glass** — `BlurView` + translucent fill + hairline highlight border on iOS; solid fallbacks on Android.
3. **Restrained depth** — Soft shadows; prefer `surfaceRaised` + `surfaceBorder` in dark mode over heavy elevation.
4. **44pt minimum touch targets** — Buttons, compact list rows, and icon controls honor HIG tap sizes.
5. **Consistent screen rails** — Default horizontal inset is `theme.spacing.md` (16pt baseline, scaled).
6. **Reduce Motion** — All motion presets respect `useReduceMotion()` via `src/ui/motion/`.
7. **Reuse before create** — Extend shared components and domain layout factories; do not introduce one-off patterns in feature screens.

---

## Color tokens

Semantic keys (never hard-code hex in feature screens):

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `background` | `#F7F6F2` | `#0d0d0d` | Page background |
| `surface` | `#ffffff` | `#1c1c1e` | Flat panels |
| `surfaceRaised` | `#ffffff` | `#262628` | Grouped cards, list sections |
| `surfaceBorder` | `rgba(60,60,67,0.14)` | `rgba(255,255,255,0.08)` | Raised surface edge (dark mode) |
| `surfaceGlass` | `rgba(255,255,255,0.72)` | `rgba(44,44,46,0.72)` | Frosted controls, cards |
| `surfaceGlassSheet` | `rgba(255,255,255,0.34)` | `rgba(44,44,46,0.38)` | Bottom sheets (lighter over blur) |
| `textPrimary` | `#1c1c1e` | `#ffffff` | Primary copy |
| `textSecondary` | `#8e8e93` | `#8e8e93` | Secondary copy, placeholders |
| `accent` | `#2d8a5e` | `#34c759` | Primary actions, links, checkmarks |
| `danger` | `#ff3b30` | `#ff453a` | Destructive actions |
| `divider` | `rgba(60,60,67,0.12)` | `rgba(84,84,88,0.65)` | Separators |
| `onAccent` | `#ffffff` | `#ffffff` | Text on accent fills |
| `onDanger` | `#ffffff` | `#ffffff` | Text on danger fills |

**Appearance:** `system` (default), `light`, or `dark` — persisted locally and synced with user preferences via `themePreferenceService`. Access via `useThemePreference()`; bootstrap gate via `useThemePreferenceReady()` in `App.tsx`.

---

## Zone / aisle system

List sections use a **domain accent palette** separate from `theme.accent`. Zone colors give the List and Shop screens energy and make each aisle instantly recognizable.

| File | Purpose |
|------|---------|
| `src/data/zoneColors.ts` | `ZONE_COLORS`, `zoneColor()`, `zoneSoftColor()` per `ZoneKey` |
| `src/data/zone.ts` | `ZONE_LABELS`, `ZONE_ICONS`, `ZONE_KEYS` |
| `src/components/brand/ZoneGlyph.tsx` | Custom SVG aisle icons (section headers, filter chips, reorder cards) |

**Rules:**

- Use `zoneColor(zone, theme.colorScheme)` and `zoneSoftColor(zone, theme.colorScheme)` — never hard-code aisle hex in feature screens.
- Prefer `ZoneGlyph` over generic Ionicons for aisle identity in list UI.
- `theme.accent` remains for app-level actions (CTAs, checkmarks, links); zone colors are for **categorization chrome only**.

```tsx
const theme = useTheme();
const color = zoneColor('produce', theme.colorScheme);
const chipBg = zoneSoftColor('produce', theme.colorScheme);
```

---

## Typography

Base scale in `typography.ts` (scaled at runtime via `theme.typography`):

| Style | Size / line | Weight | Font |
|-------|-------------|--------|------|
| `largeTitle` | 34 / 40 | 600 | Plus Jakarta Sans SemiBold |
| `title1` | 28 / 34 | 700 | Plus Jakarta Sans Bold |
| `title2` | 22 / 28 | 600 | Plus Jakarta Sans SemiBold |
| `title3` | 20 / 25 | 600 | Plus Jakarta Sans SemiBold |
| `headline` | 17 / 22 | 600 | System |
| `body` | 17 / 22 | 400 | System |
| `callout` | 16 / 21 | 400 | System |
| `subhead` | 15 / 20 | 400 | System |
| `footnote` | 13 / 18 | 400 | System |
| `caption` | 13 / 18 | 400 | System |
| `caption1` | 12 / 16 | 400 | System |
| `caption2` | 11 / 13 | 400 | System |

**Guidelines:**

- Labels and metadata → `footnote` or `subhead`
- Primary content → `body`
- Screen titles → `largeTitle` / `title2` via `LargeTitleHeader`, `SimpleTabHeader`, or stack headers
- Section labels in grouped lists → `caption1` uppercase via `ListSection` `titleVariant="small"`
- Custom sizes → `scaleFontPx(theme.fontScale, n)` from `layoutMetrics.ts`

---

## Spacing

Base scale (`theme.spacing` is width-scaled):

| Token | pt | Typical use |
|-------|-----|-------------|
| `xxs` | 2 | Tight stack gap below headers |
| `xs` | 4 | Micro gaps |
| `sm` | 8 | Related elements (label + control) |
| `base` | 12 | Section headers, tight form groups |
| `md` | 16 | Screen horizontal padding, form sections |
| `comfort` | 20 | Card padding, hero gaps |
| `lg` | 24 | Section breaks between blocks |
| `xl` | 32 | Sheet bottom padding, large gaps |
| `xxl` | 48 | Hero / marketing spacing |

**HIG alignment:** 16–24pt between sections; 8pt between related controls.

---

## Radius

| Token | pt | Use |
|-------|-----|-----|
| `xs` | 6 | Small chips |
| `sm` | 8 | — |
| `md` | 12 | Buttons |
| `input` | 14 | Text fields, small pills |
| `lg` | 16 | — |
| `card` | 20 | Cards, section groups |
| `xl` | 20 | Alias of card |
| `glass` | 20 | Glass surfaces (default `GlassSurface` radius) |
| `sheet` | 28 | Bottom sheets / modal top corners |
| `full` | 9999 | Pills, circular buttons |

---

## Shadows & depth

Shared elevation tiers in `shadows.ts`:

| Token | Tier | Use |
|-------|------|-----|
| *(none)* | 0 | Page background |
| `card` | 1 | Grouped cards |
| `elevated` | 2 | Selected pills, nested tiles |
| `floating` | 3 | FAB, dialogs |
| `chrome` | — | Bottom quick-add bar, docked chrome |
| `glass` | — | Subtle glass surface shadow |
| `thumb` | — | Toggle thumbs |
| `sm` / `md` / `lg` | Legacy | Generic elevation helpers |

Prefer **`Card`** with `surface="raised" | "glass" | "flat" | "nested"` instead of ad-hoc shadow styles. Use `cardShellStyle(theme, surface, tone)` when building custom grouped containers.

**Card tones:** `default` | `interactive` | `informational` | `status` — semantic role for consistent treatment across screens.

---

## Responsive layout & navigation chrome

Reference device width: **440pt** (iPhone 16 Pro Max class).

| Constant | Value | Purpose |
|----------|-------|---------|
| `DESIGN_REFERENCE_WIDTH_PT` | 440 | Baseline width |
| `LAYOUT_SCALE_MIN` | 0.92 | Floor for small phones |
| `LAYOUT_SCALE_MAX` | 1.06 | Ceiling for large phones |
| `FONT_SCALE_SOFTEN` | 0.88 | Typography scales less than layout |

`useTheme()` exposes `layoutScale`, `fontScale`, and scaled token objects. Use `scaleLayoutPx()` / `scaleFontPx()` for one-off dimensions (icons, fixed chrome).

**Tab layout:** Main tabs are **List · Meals · Recipes · Profile** (`TabsNavigator.tsx`). Use `tabRootHeaderHeight()` and `tabScrollPaddingTopBelowHeader()` in `layout.ts` to keep tab-root scroll insets stable across all four tabs.

**Navigation chrome** (`src/ui/chrome/`):

| Export | Purpose |
|--------|---------|
| `navigationChromeBlur` | iOS `56`, Android `48` — shared header + tab bar intensity |
| `navigationChromeTintOverlay()` | Neutral veil over blur |
| `NavigationChromeSurface` | Stack header background |
| `TabBarChromeBackground` | Tab bar frosted background |
| `ChromeBlurLayers` | Shared blur layer helper |
| `useScrollContentInsetTop` | Scroll inset under translucent headers |

No hairline separators on chrome (`navigationChromeHairline` returns transparent).

---

## Motion

Central tokens in `src/ui/motion/tokens.ts`. Import from `src/ui/motion/` (not `src/design/motion.ts` in new code).

### Durations (ms)

| Token | Value | Use |
|-------|-------|-----|
| `micro` | 120 | Micro feedback |
| `fast` | 180 | Quick state changes |
| `standard` | 240 | Default transitions |
| `modalEnter` | 320 | Sheet/modal present |
| `modalExit` | 260 | Sheet/modal dismiss |
| `backdrop` | 220 | Backdrop fade |
| `alertEnter` / `alertExit` | 200 / 160 | Dialogs |
| `menuPresent` / `menuDismiss` | 160 / 140 | Anchored menus |
| `pressIn` / `pressOut` | 88 / 140 | Button press |
| `toggleTrack` | 180 | Toggle cross-fade |
| `fabScrollCollapse` | 150 | FAB label hide on scroll |
| `fabScrollSettleRM` | 220 | FAB settle (Reduce Motion) |

### Easing

| Token | Use |
|-------|-----|
| `easeOut` | Entrances, non-interactive |
| `easeInOut` | Simple state changes |
| `easeIn` | Dismissals — use sparingly |

### Springs

| Token | Use |
|-------|-----|
| `sheetSnap` / `sheetReturn` | Bottom sheet snap and return |
| `toggleThumb` | Toggle thumb |
| `fabExpand` / `fabPress` / `fabSettle` | FAB expand, press, scroll settle |

### Backdrop, gesture, distance

| Category | Key values |
|----------|------------|
| Backdrop | `dim` 0.28, `dimMenu` 0.08 |
| Sheet dismiss | velocity 900 pt/s, progress 0.35, min drag 72pt |
| Press scale | `pressScaleDown` 0.985 |
| Reduce Motion | durations × `0.35` (min **60ms**) |

Use helpers from `src/ui/motion/presets.ts` (`getMotionTiming`, `modalEnterTiming`, `pressInTiming`, etc.) and **`useReduceMotion()`** in animated components. List-specific presets live in `lists.ts`; navigation transitions in `navigation.ts`.

---

## Liquid Glass & blur

### `GlassSurface` / `GlassView`

- iOS: `expo-blur` `BlurView` + translucent fill + 1px highlight border + `shadows.card`
- Android: solid `surfaceRaised` fallback
- Default blur **intensity: 32**; sheet variant uses `Math.max(intensity, 55)`
- **`fillVariant`:** `default` → `surfaceGlass`; `sheet` → `surfaceGlassSheet` (more transparent)
- Default border radius: `theme.radius.glass` (20pt)

### Bottom sheets

- Top corner radius: `theme.radius.sheet` (28pt)
- Drag handle on dismissible sheets
- Padding: 16–24pt (`theme.spacing.md`–`lg`)
- Forms: use `KeyboardSafeForm` / `KeyboardAvoidingView`

---

## Component library

### Layout & structure

| Component | Path | Purpose |
|-----------|------|---------|
| `Screen` | `components/ui/Screen.tsx` | Page wrapper: background, safe area, optional `md` horizontal padding |
| `Card` | `components/ui/Card.tsx` | Grouped content; `surface`, `tone`, legacy `glass` prop |
| `ListSection` | `components/ui/ListSection.tsx` | Grouped list container with optional title |
| `ListRow` | `components/ui/ListRow.tsx` | iOS-style row; 56pt default, 44pt compact |
| `Divider` | `components/ui/Divider.tsx` | Hairline separators |
| `PushedScreenHeader` | `components/ui/PushedScreenHeader.tsx` | Standard pushed settings/detail header |
| `LargeTitleHeader` | `components/ui/LargeTitleHeader.tsx` | Large title hero header |
| `SimpleTabHeader` | `components/ui/SimpleTabHeader.tsx` | Tab-root large title |

**`ListSection` props:** `titleVariant` (`small` | `title2`), `dense`, `overflowVisible`, `headerRight`, `surface`, `tone`, `glass`.

### Actions & inputs

| Component | Purpose |
|-----------|---------|
| `PrimaryButton` | Pill CTA, accent fill, optional elevation |
| `Button` | `primary` / `secondary` / `tertiary` variants |
| `SecondaryButton` | Outlined / muted actions |
| `IconButton` / `HeaderIconButton` | Toolbar and header actions |
| `PressableScale` | Standard press feedback (scale ~0.985); canonical in `ui/components/` |
| `FloatingAddButton` | FAB with scroll-collapse behavior |
| `TextField` | Form text input |
| `AppSelectField` / `AppDateField` | Picker-style fields |
| `SelectorRow` | Settings-style picker rows |
| `SegmentedControl` / `SegmentedPillControl` | Segmented choices |

### Overlays

| Component | Purpose |
|-----------|---------|
| `BottomSheet` / `Sheet` | Bottom sheet shell (unified motion) |
| `ModalSheet` (`ui/components/`) | Full modal sheet primitive |
| `AppActionSheet` | Action sheet pattern |
| `AppConfirmationDialog` | Confirmations |
| `AlertDialog` (`ui/components/`) | Alert dialog primitive |
| `AnchoredMenu` | Popover menus (re-export of `PopoverMenu`) |
| `NativeContextMenu` | iOS context menus |
| `DatePickerSheet` / `EmojiPickerSheet` / `UnitPickerSheet` | Domain picker sheets |

### Feedback & states

| Component | Purpose |
|-----------|---------|
| `EmptyState` | Icon or mascot + title + message; optional glass wrap |
| `BootstrapLoadingScreen` | App bootstrap loading |
| `AnimatedStatusLoadingPage` | Full-page loading state |
| `QueryLoadErrorPanel` | Error + retry for queries |
| `AppToast` | Toast wrapper (react-native-toast-message) |
| `AnimatedQuantityValue` | Quantity change micro-animation |

### Glass helpers

| Component | Purpose |
|-----------|---------|
| `GlassSurface` | Primary frosted container |
| `GlassView` | Lower-level glass wrapper |
| `GlassPrimitives` | Building blocks for custom glass layouts |

---

## Domain layout factories

Shared spacing/style factories — use these instead of duplicating layout constants in feature screens.

| File | Exports | Use |
|------|---------|-----|
| `src/design/recipeLayout.ts` | `RECIPE_CARD_GAP`, `recipeSectionStyle`, `recipeListSectionProps`, `recipeActionStackStyle` | Recipe list, edit, detail screens |
| `src/screens/onboarding/onboardingTokens.ts` | `createOnboardingLayout()`, `onboardingPageGradient` | Onboarding flow spacing and page tint |
| `src/components/list/quickAddComposerStyles.ts` | `createQuickAddComposerStyles(theme)` | Quick-add and quantity composer sheets |

---

## Feature patterns

Canonical components by feature area. **Extend these** when building new flows — do not create parallel list row or sheet patterns.

### List & Shop

| Component | Purpose |
|-----------|---------|
| `ZoneSection` | Aisle-grouped list section |
| `ListItemRow` | Individual list item with check, quantity, swipe |
| `ShopProgressBar` | Shop mode progress |
| `PlanReadinessStrip` | Plan vs shop readiness indicator |
| `ProgressHeader` / `ListStatsHeader` | List header stats |
| `BottomQuickAddBar` | Docked quick-add chrome |
| `QuickAddComposer` | Add/edit item sheet |
| `QuantityEditSheet` | Quantity and unit editing |
| `ShopRunCompleteOverlay` | Shop run completion celebration |
| `ListActionsSheet` / `DuplicateResolutionSheet` | List actions and duplicate handling |

### Meals & Recipes

| Component | Purpose |
|-----------|---------|
| `DaySection` / `MealCard` / `WeekStrip` | Meals planner layout |
| `RecipeCard` / `RecipeMetaPills` / `IngredientList` | Recipe list and detail |
| `RecipeAiImportOverlay` | AI recipe import flow |

Use `recipeLayout.ts` presets for section spacing on all recipe screens.

### Onboarding & Auth

| Component | Purpose |
|-----------|---------|
| `OnboardingStepHeader` | Eyebrow + title + subtitle |
| `OnboardingBottomCta` | Pinned primary/secondary CTAs |
| `OnboardingTopChrome` | Progress bar chrome |
| `OnboardingAnimatedStep` / `OnboardingStagger` | Step transitions |
| `OnboardingWelcomeFeatured` / `OnboardingTabsOrientation` / etc. | Step-specific featured content |
| `WelcomeIntroScreen` | Pre-auth carousel (List / Meals / Recipes preview) |
| `SignInValueStrip` | Auth screen value props |

Onboarding uses `createOnboardingLayout(theme.spacing, theme.layoutScale)` for device-aware insets.

### Subscription & paywall

| Component | Purpose |
|-----------|---------|
| `ContextualPaywallOverlay` | In-context Listio+ upsell |
| `FreeTierUsageBanner` | Free tier limit banner |
| `SubscriptionLegalLinks` | Legal links on plan/onboarding |

---

## Brand

| Component | Path | Purpose |
|-----------|------|---------|
| `Mascot` | `components/brand/Mascot.tsx` | Listio grocery-bag character |
| `ZoneGlyph` | `components/brand/ZoneGlyph.tsx` | Custom aisle SVG icons |

### Mascot moods

| Mood | Asset | Use |
|------|-------|-----|
| `hero` | `mascot-hero.png` | Onboarding, general hero surfaces |
| `celebrate` | `mascot-celebrate.png` | Shop run complete, payoff moments |
| `empty` | `mascot-empty.png` | Empty states |

Pass `mascot` to `EmptyState` instead of a generic icon:

```tsx
<EmptyState
  icon="cart-outline"
  mascot="empty"
  title="Nothing on your list yet"
  message="Add a few items to get started."
/>
```

Mascot supports idle float, mood transition, entrance, and periodic wiggle — all disabled when Reduce Motion is on.

---

## Usage patterns

### Themed styles

```tsx
import { useTheme } from '../hooks/useTheme';

const theme = useTheme();

<View style={{
  backgroundColor: theme.surfaceRaised,
  borderRadius: theme.radius.card,
  padding: theme.spacing.md,
  ...theme.shadows.card,
}}>
  <Text style={[theme.typography.body, { color: theme.textPrimary }]}>
    …
  </Text>
</View>
```

### Single color token

```tsx
import { useThemeColor } from '../hooks/useTheme';

const accent = useThemeColor('accent');
```

### Horizontal chip scroll inset bleed

When a parent has horizontal padding, use `horizontalScrollInsetBleed(inset)` from `layout.ts` so chips can scroll edge-to-edge without looking clipped.

### Recipe section preset

```tsx
import { recipeListSectionProps } from '../design/recipeLayout';

<ListSection title="Ingredients" {...recipeListSectionProps}>
  …
</ListSection>
```

---

## Accessibility

- Minimum **44×44pt** touch targets on interactive controls
- `accessibilityRole` and `accessibilityLabel` on buttons (`Button`, `PressableScale`)
- Sufficient contrast: primary text on background; `textSecondary` for non-critical copy only
- Respect **Reduce Motion** for all custom animations
- Support **light / dark / system** appearance via `useThemePreference()`

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-08 | Initial design system documentation |
| 2026-06-28 | Full rewrite: zone/aisle system, domain layout factories, feature patterns, expanded motion tokens, navigation chrome, brand/mascot moods, corrected tab names (Profile not Store), component catalog and re-export notes |
