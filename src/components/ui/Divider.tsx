import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { useTheme } from '../../design/ThemeContext';

type DividerProps = {
  style?: ViewStyle;
  vertical?: boolean;
};

export function Divider({ style, vertical = false }: DividerProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        vertical ? { width: 1 } : { height: 1 },
        { backgroundColor: theme.divider },
        style,
      ]}
    />
  );
}
