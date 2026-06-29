import React, { useLayoutEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { EmptyState } from '../../components/ui/EmptyState';
import { ListModeToggleBar } from '../../components/list/ListModeToggleBar';
import { useTheme } from '../../design/ThemeContext';
import { listModeSwapMotion, listModeSwapTiming } from '../../ui/motion/controls';

type Props = {
  scrollContentPaddingTop: number;
  scrollContentPaddingBottom: number;
  shoppingMode: 'plan' | 'shop';
  onShoppingModeChange: (mode: 'plan' | 'shop') => void;
  showModeToggle: boolean;
  /** When the list switcher row is hidden, inset toggle below the status bar. */
  padTopWhenNoSwitcher: boolean;
  safeAreaTop: number;
  reduceMotion: boolean;
  onRegisterModeSwapStarter?: (starter: (() => void) | null) => void;
};

export function HomeScreenEmptyState({
  scrollContentPaddingTop,
  scrollContentPaddingBottom,
  shoppingMode,
  onShoppingModeChange,
  showModeToggle,
  padTopWhenNoSwitcher,
  safeAreaTop,
  reduceMotion,
  onRegisterModeSwapStarter,
}: Props) {
  const theme = useTheme();
  const listContentOpacity = useSharedValue(1);

  useLayoutEffect(() => {
    if (!onRegisterModeSwapStarter) return;
    const startModeSwap = () => {
      if (reduceMotion) return;
      listContentOpacity.value = listModeSwapMotion.contentFadeMin;
      listContentOpacity.value = withTiming(1, listModeSwapTiming(reduceMotion));
    };
    onRegisterModeSwapStarter(startModeSwap);
    return () => onRegisterModeSwapStarter(null);
  }, [onRegisterModeSwapStarter, reduceMotion, listContentOpacity, shoppingMode]);

  const listContentFadeStyle = useAnimatedStyle(() => ({
    opacity: listContentOpacity.value,
  }));

  const styles = useMemo(
    () =>
      StyleSheet.create({
        scroll: { flex: 1 },
        content: {
          flexGrow: 1,
          paddingHorizontal: theme.spacing.md,
        },
        modeToggleWrap: {
          marginBottom: theme.spacing.sm,
        },
        emptyWrap: {
          flex: 1,
          paddingHorizontal: theme.spacing.xs,
        },
      }),
    [theme],
  );

  return (
    <Animated.ScrollView
      style={[styles.scroll, listContentFadeStyle]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: scrollContentPaddingTop, paddingBottom: scrollContentPaddingBottom },
        padTopWhenNoSwitcher && { paddingTop: safeAreaTop + theme.spacing.xs },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {showModeToggle ? (
        <View style={styles.modeToggleWrap}>
          <ListModeToggleBar
            shoppingMode={shoppingMode}
            onShoppingModeChange={onShoppingModeChange}
          />
        </View>
      ) : null}
      <View style={styles.emptyWrap}>
        <EmptyState
          icon="cart-outline"
          mascot="empty"
          title="Your list's empty for now"
          message="Add a few things and we'll line them up by aisle, so your next shop is one smooth loop."
          glass={false}
        />
      </View>
    </Animated.ScrollView>
  );
}
