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
| Theme hook | `src/design/ThemeContext.tsx` | `useTheme()`, scaling, appearance preference |
| Typography | `src/design/typography.ts` | iOS-style type scale |
| Spacing | `src/design/spacing.ts` | 8pt-based rhythm |
| Radius | `src/design/radius.ts` | Cards, inputs, sheets |
| Shadows | `src/design/shadows.ts` | Depth tiers |
| Layout scaling | `src/design/layoutMetrics.ts` | Responsive scale from reference width |
| Layout helpers | `src/design/layout.ts` | Tab header heights, scroll insets |
| Fonts | `src/design/fonts.ts` | Plus Jakarta Sans assets |
| Motion | `src/ui/motion/` | Durations, easing, springs (prefer over `src/design/motion.ts` re-export) |
| Navigation chrome | `src/ui/chrome/` | Header/tab bar blur and tint |
| Shared UI | `src/components/ui/` | Buttons, rows, sheets, cards, fields |
| UI primitives | `src/ui/components/` | ModalSheet, SegmentedPillControl, PressableScale |
| Token export | `npm run tokens:export` | Writes `design-tokens.tokens.json` for design tools |

**Always consume tokens through `useTheme()`** in components — not raw imports from `spacing.ts` / `typography.ts` (except static StyleSheet defaults or tests). `useTheme()` returns **scaled** spacing, radius, typography, and shadows based on window width.

---

## Design principles

1. **Apple-like hierarchy** — Large titles for hero moments; body for content; footnote/subhead for labels and metadata.
2. **Liquid Glass** — `BlurView` + translucent fill + hairline highlight border on iOS; solid fallbacks on Android.
3. **Restrained depth** — Soft shadows; prefer `surfaceRaised` + `surfaceBorder` in dark mode over heavy elevation.
4. **44pt minimum touch targets** — Buttons, compact list rows, and icon controls honor HIG tap sizes.
5. **Consistent screen rails** — Default horizontal inset is `theme.spacing.md` (16pt baseline, scaled).
6. **Reduce Motion** — All motion presets respect `useReduceMotion()` via `src/ui/motion/`.

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

**Appearance:** `system` (default), `light`, or `dark` — persisted locally and synced with user preferences. Access via `useThemePreference()`.

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
- Screen titles → `largeTitle` / `title2` via `LargeTitleHeader` or stack headers
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
| `lg` / `card` / `xl` / `glass` | 16–20 | Cards, glass surfaces |
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

Prefer **`Card`** with `surface="raised" | "glass" | "flat" | "nested"` instead of ad-hoc shadow styles.

---

## Responsive layout

Reference device width: **440pt** (iPhone 16 Pro Max class).

| Constant | Value | Purpose |
|----------|-------|---------|
| `LAYOUT_SCALE_MIN` | 0.92 | Floor for small phones |
| `LAYOUT_SCALE_MAX` | 1.06 | Ceiling for large phones |
| `FONT_SCALE_SOFTEN` | 0.88 | Typography scales less than layout |

`useTheme()` exposes `layoutScale`, `fontScale`, and scaled token objects. Use `scaleLayoutPx()` / `scaleFontPx()` for one-off dimensions (icons, fixed chrome).

**Tab layout:** `tabRootHeaderHeight()` and `tabScrollPaddingTopBelowHeader()` in `layout.ts` keep tab-root scroll insets stable across List, Meals, Recipes, and Store.

---

## Motion

Central tokens in `src/ui/motion/tokens.ts`:

| Category | Examples |
|----------|----------|
| **Durations** | `micro` 120ms, `standard` 240ms, `modalEnter` 320ms, `pressIn` 88ms |
| **Easing** | `easeOut` (entrances), `easeInOut` (state), `easeIn` (dismissals — sparingly) |
| **Springs** | `sheetSnap`, `toggleThumb`, `fabExpand` — restrained, minimal bounce |
| **Backdrop** | `dim` 0.28, `dimMenu` 0.08 |
| **Reduce Motion** | Durations × `0.35` (min 60ms) |

Use helpers from `src/ui/motion/presets.ts` (`getMotionTiming`, `modalEnterTiming`, etc.) and **`useReduceMotion()`** in animated components.

---

## Liquid Glass & blur

### `GlassSurface` / `GlassView`

- iOS: `expo-blur` `BlurView` + translucent fill + 1px highlight border + `shadows.card`
- Android: solid `surfaceRaised` fallback
- **`fillVariant`:** `default` → `surfaceGlass`; `sheet` → `surfaceGlassSheet` (more transparent)

### Navigation chrome

- Shared blur intensity: **56** (iOS), **48** (Android) — `navigationChromeBlur`
- Neutral tint overlay via `navigationChromeTintOverlay(scheme)`
- No hairline separators on chrome (returns transparent)

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
| `Screen` | `components/ui/Screen.tsx` | Page wrapper: background, safe area, `md` horizontal padding |
| `Card` | `components/ui/Card.tsx` | Grouped content; glass / raised / flat / nested surfaces |
| `ListSection` | `components/ui/ListSection.tsx` | Grouped list container |
| `ListRow` | `components/ui/ListRow.tsx` | iOS-style row; 56pt default, 44pt compact |
| `Divider` | `components/ui/Divider.tsx` | Hairline separators |

### Actions & inputs

| Component | Purpose |
|-----------|---------|
| `PrimaryButton` | Pill CTA, accent fill, optional elevation |
| `Button` | `primary` / `secondary` / `tertiary` variants |
| `SecondaryButton` | Outlined / muted actions |
| `IconButton` / `HeaderIconButton` | Toolbar and header actions |
| `PressableScale` | Standard press feedback (scale ~0.985) |
| `TextField` | Form text input |
| `AppSelectField` / `AppDateField` | Picker-style fields |
| `SegmentedControl` / `SegmentedPillControl` | Segmented choices |

### Overlays

| Component | Purpose |
|-----------|---------|
| `BottomSheet` / `Sheet` | Bottom sheet shell (unified motion) |
| `ModalSheet` (`ui/components/`) | Full modal sheet primitive |
| `AppActionSheet` | Action sheet pattern |
| `AppConfirmationDialog` / `AlertDialog` | Confirmations |
| `PopoverMenu` / `NativeContextMenu` | Context menus |

### Feedback & states

| Component | Purpose |
|-----------|---------|
| `EmptyState` | Icon or mascot + title + message; optional glass wrap |
| `BootstrapLoadingScreen` | App bootstrap loading |
| `QueryLoadErrorPanel` | Error + retry for queries |
| `AppToast` | Toast wrapper (react-native-toast-message) |

### Brand

| Component | Purpose |
|-----------|---------|
| `Mascot` | Listio mascot moods in empty states and onboarding |

---

## Usage patterns

### Themed styles

```tsx
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
const accent = useThemeColor('accent');
```

### Horizontal chip scroll inset bleed

When a parent has horizontal padding, use `horizontalScrollInsetBleed(inset)` from `layout.ts` so chips can scroll edge-to-edge without looking clipped.

---

## Accessibility

- Minimum **44×44pt** touch targets on interactive controls
- `accessibilityRole` and `accessibilityLabel` on buttons (`Button`, `PressableScale`)
- Sufficient contrast: primary text on background; `textSecondary` for non-critical copy only
- Respect **Reduce Motion** for all custom animations
- Support **light / dark / system** appearance

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-08 | Initial design system documentation |
