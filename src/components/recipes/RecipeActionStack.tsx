import React from 'react';
import { View, type ViewStyle, type StyleProp } from 'react-native';
import { recipeActionStackStyle } from '../../design/recipeLayout';

type RecipeActionStackProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Full-width stacked CTAs on recipe screens — shared gap matches import overlay rhythm. */
export function RecipeActionStack({ children, style }: RecipeActionStackProps) {
  return <View style={[recipeActionStackStyle, style]}>{children}</View>;
}
