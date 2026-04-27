import { StyleSheet } from 'react-native';
import type { AppTheme } from '../../design/ThemeContext';

/** Theme-aware styles for store edit UI (call from a screen with `useTheme()`). */
export function createStoreEditStyles(theme: AppTheme) {
  const { spacing, radius } = theme;
  return StyleSheet.create({
    keyboard: { flex: 1 },
    scroll: { flex: 1 },
    content: {},
    sectionFirst: { marginBottom: spacing.lg },
    section: { marginBottom: spacing.lg },
    sectionAisle: { marginBottom: spacing.lg },
    field: { marginBottom: spacing.sm },
    fieldOptional: { marginBottom: spacing.xs },
    locationBtn: { marginBottom: spacing.sm },
    mapsLink: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 44,
      marginBottom: spacing.sm,
      gap: spacing.xs,
    },
    mapsLinkIcon: { marginTop: 1 },
    suggestList: {
      maxHeight: 200,
      borderRadius: radius.card,
      borderWidth: StyleSheet.hairlineWidth,
      marginBottom: spacing.sm,
      overflow: 'hidden',
    },
    suggestRow: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 56,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    aisleCard: {
      overflow: 'hidden',
    },
    addAisleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 56,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      gap: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    saveSection: {
      paddingHorizontal: 0,
      paddingTop: spacing.lg,
    },
    saveBtn: { minHeight: 50 },
    headerEditBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
    },
  });
}
