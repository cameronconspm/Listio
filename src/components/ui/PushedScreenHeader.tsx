import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../design/ThemeContext';
import { HeaderIconButton } from './HeaderIconButton';
import { spacing } from '../../design/spacing';

type PushedScreenHeaderProps = {
  title: string;
  onBack: () => void;
  rightAccessory?: React.ReactNode;
};

/**
 * Header for pushed pages that should move with the scene instead of floating as
 * native navigation chrome. Keep this inside the screen tree.
 */
export function PushedScreenHeader({ title, onBack, rightAccessory }: PushedScreenHeaderProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          backgroundColor: theme.background,
        },
      ]}
    >
      <HeaderIconButton accessibilityLabel="Back" onPress={onBack}>
        <Ionicons name="chevron-back" size={26} color={theme.textPrimary} />
      </HeaderIconButton>
      <Text
        style={[theme.typography.body, styles.title, { color: theme.textPrimary }]}
        numberOfLines={1}
      >
        {title}
      </Text>
      <View style={styles.actionSlot} pointerEvents={rightAccessory ? 'auto' : 'none'}>
        {rightAccessory}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 44,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  title: {
    flex: 1,
    marginHorizontal: spacing.sm,
    marginBottom: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  actionSlot: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
