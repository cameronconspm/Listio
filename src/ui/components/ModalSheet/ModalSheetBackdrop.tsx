import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import type { StyleProp, ViewStyle } from 'react-native';

type ModalSheetBackdropProps = {
  animatedStyle: StyleProp<ViewStyle>;
  onPress: () => void;
  testID?: string;
};

export function ModalSheetBackdrop({ animatedStyle, onPress, testID }: ModalSheetBackdropProps) {
  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.backdrop, animatedStyle]}
      pointerEvents="auto"
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onPress}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel="Dismiss sheet"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,1)',
  },
});
