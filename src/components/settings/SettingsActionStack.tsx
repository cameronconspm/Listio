import React from 'react';
import { View, type ViewStyle, type StyleProp } from 'react-native';
import { settingsActionStackStyle } from '../../design/settingsLayout';

type SettingsActionStackProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Full-width stacked CTAs on profile / settings pushed screens. */
export function SettingsActionStack({ children, style }: SettingsActionStackProps) {
  return <View style={[settingsActionStackStyle, style]}>{children}</View>;
}
