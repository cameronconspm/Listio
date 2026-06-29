import React, { Children, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../design/ThemeContext';
import {
  AUTH_PRIMARY_TO_PROVIDERS_GAP,
  AUTH_PROVIDER_DIVIDER_PAD,
  AUTH_PROVIDER_DIVIDER_TO_BUTTON_GAP,
  AUTH_PROVIDER_GAP,
} from '../../design/authLayout';

type AuthProviderStackProps = {
  children: React.ReactNode;
  /** Shown between the primary email action and OAuth buttons. Set to null to hide. */
  dividerLabel?: string | null;
};

/**
 * Vertical stack for OAuth / social sign-in buttons with consistent spacing.
 * Wrap each provider button as a child; null children are omitted (e.g. Apple on Android).
 */
export function AuthProviderStack({
  children,
  dividerLabel = 'or',
}: AuthProviderStackProps) {
  const theme = useTheme();
  const providers = Children.toArray(children).filter(Boolean);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: {
          marginTop: AUTH_PRIMARY_TO_PROVIDERS_GAP,
        },
        dividerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingVertical: AUTH_PROVIDER_DIVIDER_PAD,
        },
        dividerLine: {
          flex: 1,
          height: StyleSheet.hairlineWidth,
        },
        providerList: {
          gap: AUTH_PROVIDER_GAP,
          marginTop: AUTH_PROVIDER_DIVIDER_TO_BUTTON_GAP,
        },
      }),
    [theme.spacing.sm],
  );

  if (providers.length === 0) return null;

  return (
    <View style={styles.section}>
      {dividerLabel ? (
        <View style={styles.dividerRow} accessibilityElementsHidden importantForAccessibility="no">
          <View style={[styles.dividerLine, { backgroundColor: theme.divider }]} />
          <Text style={[theme.typography.footnote, { color: theme.textSecondary }]}>{dividerLabel}</Text>
          <View style={[styles.dividerLine, { backgroundColor: theme.divider }]} />
        </View>
      ) : null}
      <View style={styles.providerList}>{providers}</View>
    </View>
  );
}
