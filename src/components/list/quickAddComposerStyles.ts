import { Platform, StyleSheet } from 'react-native';
import type { AppTheme } from '../../design/ThemeContext';

/** Matches `BottomQuickAddBar` item field — left-aligned, vertically centered in a 44pt track. */
function singleLineComposerInput(theme: Pick<AppTheme, 'spacing'>) {
  return {
    minHeight: 44,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    textAlign: 'left' as const,
    textAlignVertical: 'center' as const,
    ...Platform.select({
      android: { includeFontPadding: false as const },
    }),
  };
}

/**
 * Edit/Add item composer — matches Listio form patterns (TextField + grouped list rows):
 *   • Body typography in bordered inputs (same as recipe/meal editors)
 *   • Grouped meta card using raised surface + ListRow-style rows
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
      paddingBottom: spacing.xxs,
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
      paddingTop: spacing.xs,
      paddingBottom: spacing.sm,
    },
    content: {
      paddingBottom: 0,
    },

    // ─── Form fields (TextField-aligned) ─────────────────────────────────
    fieldLabel: {
      marginBottom: spacing.xxs,
    },
    /** Row holds the name input shell + optional sparkle toggle. */
    nameFieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    nameFieldShell: {
      flex: 1,
      minHeight: 44,
      borderWidth: 1,
      borderRadius: radius.input,
      justifyContent: 'center',
    },
    nameInput: {
      flex: 1,
      margin: 0,
      ...singleLineComposerInput({ spacing }),
    },
    noteFieldShell: {
      minHeight: 44,
      borderWidth: 1,
      borderRadius: radius.input,
      justifyContent: 'center',
    },
    noteInput: {
      margin: 0,
      ...singleLineComposerInput({ spacing }),
    },
    heroSmartBtn: {
      width: 44,
      height: 44,
      borderRadius: radius.input,
      borderWidth: StyleSheet.hairlineWidth,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ─── Smart-mode (natural language) input ─────────────────────────────
    smartInput: {
      minHeight: 120,
      maxHeight: 200,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderRadius: radius.input,
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
    metaSectionTitle: {
      marginTop: spacing.md,
      marginBottom: spacing.xs,
      textTransform: 'uppercase' as const,
    },
    metaCard: {
      borderRadius: radius.card,
      overflow: 'hidden',
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      minHeight: 44,
      gap: spacing.sm,
    },
    metaLabel: {
      flex: 1,
      minWidth: 0,
    },
    metaValueText: {
      flexShrink: 1,
      textAlign: 'right',
    },
    metaChevron: {
      marginLeft: spacing.xxs,
    },
    metaDivider: {
      height: StyleSheet.hairlineWidth,
      marginLeft: spacing.md,
    },

    // ─── Inline stepper (lives inside a meta row) ────────────────────────
    inlineStepper: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: radius.full,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: 'hidden',
      height: 32,
    },
    inlineStepperBtn: {
      width: 32,
      height: 32,
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
