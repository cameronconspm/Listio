import React, { useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  Linking,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../../design/ThemeContext';
import { PRIVACY_POLICY_URL, TERMS_OF_USE_URL } from '../../constants/legalUrls';
import { spacing } from '../../design/spacing';

type Props = {
  style?: StyleProp<ViewStyle>;
};

export function SubscriptionLegalLinks({ style }: Props) {
  const theme = useTheme();

  const open = useCallback((url: string) => {
    void Linking.openURL(url).catch(() => {
      Alert.alert('Could not open link', 'Open thelistioapp.com in your browser to read this document.');
    });
  }, []);

  return (
    <View style={[styles.row, style]}>
      <Pressable
        onPress={() => open(PRIVACY_POLICY_URL)}
        accessibilityRole="link"
        accessibilityLabel="Privacy policy"
        hitSlop={8}
      >
        <Text style={[theme.typography.footnote, { color: theme.accent }]}>Privacy policy</Text>
      </Pressable>
      <Text style={[theme.typography.footnote, { color: theme.textSecondary, marginHorizontal: spacing.xs }]}>
        ·
      </Text>
      <Pressable
        onPress={() => open(TERMS_OF_USE_URL)}
        accessibilityRole="link"
        accessibilityLabel="Terms of use"
        hitSlop={8}
      >
        <Text style={[theme.typography.footnote, { color: theme.accent }]}>Terms of use</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
