import React, { useMemo, type ReactNode } from 'react';
import { View, StyleSheet, Pressable, Text, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PrimaryButton } from '../ui/PrimaryButton';
import { createOnboardingLayout } from '../../screens/onboarding/onboardingTokens';
import { scaleLayoutPx } from '../../design/layoutMetrics';
import { useTheme } from '../../design/ThemeContext';

type SecondaryAction = {
  label: string;
  onPress: () => void;
  /** Accessibility label when different from visible label */
  accessibilityLabel?: string;
};

type Props = {
  bottomInset: number;
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  secondaryAction?: SecondaryAction | null;
  /** Rendered below the primary button (e.g. subscription legal on final onboarding step). */
  footer?: ReactNode | null;
  /** Called when the pinned footer is laid out — use to pad scroll content above it. */
  onHeightChange?: (height: number) => void;
};

/** Pinned primary CTA with opaque scrim so scrolled content never shows through. */
export function OnboardingBottomCta({
  bottomInset,
  label,
  onPress,
  loading,
  disabled,
  secondaryAction,
  footer,
  onHeightChange,
}: Props) {
  const theme = useTheme();
  const onboardingLayout = useMemo(
    () => createOnboardingLayout(theme.spacing, theme.layoutScale),
    [theme],
  );
  const footerMaxHeight = useMemo(
    () => scaleLayoutPx(theme.layoutScale, 220),
    [theme.layoutScale],
  );

  return (
    <View
      style={styles.wrap}
      pointerEvents="box-none"
      onLayout={
        onHeightChange
          ? (e) => onHeightChange(e.nativeEvent.layout.height)
          : undefined
      }
    >
      <LinearGradient
        colors={[`${theme.background}00`, `${theme.background}F2`, theme.background]}
        locations={[0, 0.35, 1]}
        style={styles.scrim}
        pointerEvents="none"
      />
      <View
        style={[styles.inner, { paddingBottom: bottomInset + theme.spacing.md, paddingTop: theme.spacing.md }]}
        pointerEvents="box-none"
      >
        <View style={{ paddingHorizontal: onboardingLayout.horizontalPadding }} pointerEvents="auto">
          <PrimaryButton title={label} onPress={onPress} loading={loading} disabled={disabled} />
          {secondaryAction ? (
            <Pressable
              onPress={secondaryAction.onPress}
              accessibilityRole="button"
              accessibilityLabel={secondaryAction.accessibilityLabel ?? secondaryAction.label}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.secondaryHit}
            >
              <Text style={[theme.typography.subhead, { fontWeight: '600', color: theme.accent, textAlign: 'center' }]}>
                {secondaryAction.label}
              </Text>
            </Pressable>
          ) : null}
          {footer ? (
            <ScrollView
              style={{ maxHeight: footerMaxHeight, marginTop: theme.spacing.sm }}
              contentContainerStyle={styles.footerScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {footer}
            </ScrollView>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  inner: {
    backgroundColor: 'transparent',
  },
  secondaryHit: {
    minHeight: 44,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  footerScrollContent: {
    paddingTop: 8,
    paddingBottom: 4,
  },
});
