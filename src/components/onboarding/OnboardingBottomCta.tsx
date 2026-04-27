import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { PrimaryButton } from '../ui/PrimaryButton';
import { createOnboardingLayout } from '../../screens/onboarding/onboardingTokens';
import { useTheme } from '../../design/ThemeContext';

type Props = {
  bottomInset: number;
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

/** Pinned primary CTA — no scrim or gradient; page background shows through. */
export function OnboardingBottomCta({ bottomInset, label, onPress, loading, disabled }: Props) {
  const theme = useTheme();
  const onboardingLayout = useMemo(() => createOnboardingLayout(theme.spacing), [theme]);

  return (
    <View
      style={[styles.wrap, { paddingBottom: bottomInset + theme.spacing.md, paddingTop: theme.spacing.md }]}
      pointerEvents="box-none"
    >
      <View style={{ paddingHorizontal: onboardingLayout.horizontalPadding }} pointerEvents="auto">
        <PrimaryButton title={label} onPress={onPress} loading={loading} disabled={disabled} />
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
    backgroundColor: 'transparent',
  },
});
