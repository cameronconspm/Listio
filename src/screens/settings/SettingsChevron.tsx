import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/ThemeContext';

export function Chevron() {
  const theme = useTheme();
  return <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />;
}
