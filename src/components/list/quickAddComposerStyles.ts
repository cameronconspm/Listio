import { StyleSheet } from 'react-native';
import type { AppTheme } from '../../design/ThemeContext';

export function createQuickAddComposerStyles(theme: Pick<AppTheme, 'spacing' | 'radius'>) {
  const { spacing, radius } = theme;
  return StyleSheet.create({
    /** Root layout inside BottomSheet (sheet lift handled by BottomSheet’s KeyboardAvoidingView). */
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
    zoneRowLabels: {
      flex: 1,
      minWidth: 0,
      marginRight: spacing.sm,
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
    sectionSummaryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 56,
      marginBottom: spacing.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.card,
      borderWidth: StyleSheet.hairlineWidth,
    },
    scrollContent: {
      flexGrow: 0,
      flexShrink: 1,
      minHeight: 0,
      alignSelf: 'stretch',
    },
    scrollContentContainer: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.xs,
    },
    content: {
      paddingBottom: 0,
    },
    itemInput: {
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
      borderRadius: radius.input,
      borderWidth: StyleSheet.hairlineWidth,
      maxHeight: 120,
    },
    itemInputSmart: {
      minHeight: 96,
      maxHeight: 200,
      textAlignVertical: 'top' as const,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    sparkleBtn: {
      width: 44,
      height: 44,
      borderRadius: radius.input,
      borderWidth: StyleSheet.hairlineWidth,
      alignItems: 'center',
      justifyContent: 'center',
    },
    suggestionsRow: {
      marginTop: spacing.sm,
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
    qtyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    qtyLabel: {
      width: 32,
    },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: radius.input,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: 'hidden',
    },
    stepperBtn: {
      width: 44,
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    stepperValue: {
      minWidth: 36,
      textAlign: 'center',
    },
    unitDropdown: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 44,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.input,
      borderWidth: StyleSheet.hairlineWidth,
    },
    addDetailsBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.md,
      paddingVertical: spacing.xs,
      alignSelf: 'flex-start',
    },
    secondaryBlock: {
      marginTop: spacing.md,
    },
    secondaryFieldBrand: {
      marginBottom: spacing.sm,
    },
    secondaryFieldNote: {
      marginBottom: 0,
    },
    footerCta: {
      alignSelf: 'stretch',
      flexShrink: 0,
      paddingHorizontal: spacing.md,
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.sm,
    },
    errorIcon: {
      marginRight: spacing.sm,
    },
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
