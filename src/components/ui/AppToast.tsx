import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useTheme } from '../../design/ThemeContext';

type ToastVariant = 'success' | 'error' | 'info';

type ToastMessageProps = {
  text1?: string;
  text2?: string;
  variant: ToastVariant;
};

function ToastMessage({ text1, text2, variant }: ToastMessageProps) {
  const theme = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          width: '92%',
          maxWidth: 420,
          minHeight: 58,
          borderRadius: theme.radius.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.divider,
          backgroundColor: theme.surface,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'center',
          ...theme.shadows.floating,
        },
        iconWrap: {
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: theme.spacing.sm,
        },
        copy: {
          flex: 1,
          minWidth: 0,
        },
        title: {
          ...theme.typography.subhead,
          color: theme.textPrimary,
          fontWeight: '600',
        },
        message: {
          ...theme.typography.footnote,
          color: theme.textSecondary,
          marginTop: 2,
        },
      }),
    [theme]
  );

  const tone =
    variant === 'error' ? theme.danger : variant === 'success' ? theme.accent : theme.textSecondary;
  const iconName =
    variant === 'error'
      ? 'alert-circle'
      : variant === 'success'
        ? 'checkmark-circle'
        : 'information-circle';

  return (
    <View style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: `${tone}18` }]}>
        <Ionicons name={iconName} size={21} color={tone} />
      </View>
      <View style={styles.copy}>
        {text1 ? (
          <Text style={styles.title} numberOfLines={1}>
            {text1}
          </Text>
        ) : null}
        {text2 ? (
          <Text style={styles.message} numberOfLines={2}>
            {text2}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function AppToast() {
  const theme = useTheme();
  const topOffset = theme.spacing.xxl + theme.spacing.md;
  const config = useMemo(
    () => ({
      success: ({ text1, text2 }: { text1?: string; text2?: string }) => (
        <ToastMessage variant="success" text1={text1} text2={text2} />
      ),
      error: ({ text1, text2 }: { text1?: string; text2?: string }) => (
        <ToastMessage variant="error" text1={text1} text2={text2} />
      ),
      info: ({ text1, text2 }: { text1?: string; text2?: string }) => (
        <ToastMessage variant="info" text1={text1} text2={text2} />
      ),
    }),
    []
  );

  return <Toast config={config} topOffset={topOffset} />;
}
