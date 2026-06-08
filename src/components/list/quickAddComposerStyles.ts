import { StyleSheet } from 'react-native';
import type { AppTheme } from '../../design/ThemeContext';

/**
 * Edit/Add item composer — redesigned to mirror Apple Reminders' edit sheet:
 *   • Hero name input as the visual anchor (no border, no chrome)
 *   • Inline transparent note input directly below
 *   • One grouped meta card with icon + label + value rows
 *
 * Rationale: the previous form-style stack (labelled, bordered field per row)
 * read as many disconnected pill containers. The grouped-list pattern is the
 * iOS-native pattern for short metadata edits and significantly improves
 * scannability inside the modal sheet.
 */
export function createQuickAddComposerStyles(theme: Pick<AppTheme, 'spacing' | 'radius'>) {
  const { spacing, radius } = theme;
  return StyleSheet.create({
    // ─── Sheet shell ─────────────────────────────────────────────────────
    keyboardAvoidingSheet: {
      alignSelf: 'stretch',
      flexGrow: 0,
      flexShrink: 1,
      minHeight: 0,
    },
    sheetLayout: {
      flexGrow: 0,
      flexShrink: 1,
      alignSelf: 'stretch',
      minHeight: 0,
      position: 'relative' as const,
    },
    sheetHeader: {
      paddingHorizontal: spacing.md,
      paddingBottom: 0,
      marginBottom: 0,
    },
    headerTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 44,
      gap: spacing.sm,
    },
    headerTitle: {
      flex: 1,
    },
    headerDivider: {
      height: StyleSheet.hairlineWidth,
      marginTop: spacing.sm,
      marginHorizontal: -spacing.md,
    },
    panelBody: {
      flexGrow: 0,
      flexShrink: 1,
      minHeight: 0,
      alignSelf: 'stretch',
    },

    // ─── Scroll body ─────────────────────────────────────────────────────
    scrollContent: {
      flexGrow: 0,
      flexShrink: 1,
      minHeight: 0,
      alignSelf: 'stretch',
    },
    scrollContentContainer: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
    },
    content: {
      paddingBottom: 0,
    },

    // ─── Hero name input ─────────────────────────────────────────────────
    /** Row holds the title input + optional sparkle (smart) toggle. */
    heroBlock: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    /** Title2 typography lives on the consumer; this just owns layout. */
    heroInput: {
      flex: 1,
      paddingVertical: spacing.xs,
      paddingHorizontal: 0,
      minHeight: 40,
    },
    heroSmartBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      alignItems: 'center',
      justifyContent: 'center',
    },
    /** Thin separator below the hero, matches list-divider rhythm. */
    heroDivider: {
      height: StyleSheet.hairlineWidth,
      marginTop: spacing.xs,
    },

    // ─── Inline note input ───────────────────────────────────────────────
    /** Tight to the hero — the note is a continuation of the title, not a separate field. */
    noteInput: {
      paddingVertical: spacing.xxs,
      paddingHorizontal: 0,
      marginTop: spacing.xxs,
      minHeight: 28,
      textAlignVertical: 'top' as const,
    },

    // ─── Smart-mode (natural language) input ─────────────────────────────
    smartInput: {
      minHeight: 120,
      maxHeight: 200,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      textAlignVertical: 'top' as const,
      marginTop: spacing.sm,
    },
    smartDisclosure: {
      marginTop: spacing.sm,
      lineHeight: 18,
    },

    // ─── Recent suggestions ──────────────────────────────────────────────
    suggestionsRow: {
      marginTop: spacing.md,
    },
    suggestionsChips: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    suggestionChip: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.full,
      borderWidth: 1,
    },

    // ─── Meta card (grouped list) ────────────────────────────────────────
    /** One container, rows divided by hairlines — iOS Settings/Reminders pattern. */
    metaCard: {
      marginTop: spacing.md,
      borderRadius: radius.lg,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
      gap: spacing.md,
      minHeight: 56,
    },
    /** Compact tinted square (28pt) holding the row icon. */
    metaIcon: {
      width: 28,
      height: 28,
      borderRadius: radius.xs + 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    metaLabel: {
      flex: 0,
      minWidth: 88,
    },
    metaSpacer: {
      flex: 1,
    },
    metaValueText: {
      flexShrink: 1,
      textAlign: 'right',
    },
    metaChevron: {
      marginLeft: spacing.xs,
    },
    /** Hairline divider inset past the icon (matches iOS inset separators). */
    metaDivider: {
      height: StyleSheet.hairlineWidth,
      marginLeft: spacing.md + 28 + spacing.md,
    },

    // ─── Inline stepper (lives inside a meta row) ────────────────────────
    inlineStepper: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: radius.full,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: 'hidden',
      height: 34,
    },
    inlineStepperBtn: {
      width: 36,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
    },
    inlineStepperValue: {
      minWidth: 28,
      textAlign: 'center',
      fontWeight: '600',
    },

    // ─── Inline brand text input (lives inside a meta row) ───────────────
    brandInlineInput: {
      flex: 1,
      textAlign: 'right',
      paddingVertical: spacing.xs,
      minWidth: 100,
    },

    // ─── Footer CTA ──────────────────────────────────────────────────────
    footerCta: {
      alignSelf: 'stretch',
      flexShrink: 0,
      paddingHorizontal: spacing.md,
    },

    // ─── Error banner ────────────────────────────────────────────────────
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.sm,
      marginBottom: spacing.sm,
    },
    errorIcon: {
      marginRight: spacing.sm,
    },

    // ─── Selector overlays (section/unit picker) ─────────────────────────
    selectorOverlayRoot: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      zIndex: 30,
      elevation: 30,
      justifyContent: 'flex-end',
      paddingHorizontal: spacing.md,
      paddingBottom: 82,
    },
    selectorBackdrop: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: 'rgba(0,0,0,0.08)',
    },
    selectorMenu: {
      maxHeight: 360,
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: 'hidden',
    },
    selectorMenuCompact: {
      maxHeight: 240,
    },
  });
}
