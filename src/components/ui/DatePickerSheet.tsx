import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../../design/ThemeContext';
import { BottomSheet } from './BottomSheet';
import { PrimaryButton } from './PrimaryButton';
import { toDateString } from '../../utils/dateUtils';
import { spacing } from '../../design/spacing';

type DatePickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  value: string;
  onSelect: (dateString: string) => void;
  title?: string;
};

/**
 * App-styled date picker sheet. Platform picker presented inside AppBottomSheet shell.
 * User never types dates manually.
 */
export function DatePickerSheet({
  visible,
  onClose,
  value,
  onSelect,
  title = 'Select date',
}: DatePickerSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [internalDate, setInternalDate] = useState(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Date(value + 'T12:00:00');
    }
    return new Date();
  });

  useEffect(() => {
    if (visible && value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      setInternalDate(new Date(value + 'T12:00:00'));
    } else if (visible) {
      setInternalDate(new Date());
    }
  }, [visible, value]);

  const handleChange = (_: unknown, selectedDate?: Date) => {
    if (selectedDate) {
      setInternalDate(selectedDate);
    }
  };

  const handleApply = () => {
    onSelect(toDateString(internalDate));
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} size="form" surfaceVariant="solid" formHugContent>
      <View style={[styles.body, { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) }]}>
        <Text style={[theme.typography.headline, { color: theme.textPrimary, marginBottom: theme.spacing.md }]}>
          {title}
        </Text>
        <View style={styles.pickerWrap}>
          <DateTimePicker
            value={internalDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleChange}
            accentColor={theme.accent}
          />
        </View>
        <PrimaryButton title="Apply" onPress={handleApply} flat style={styles.applyBtn} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    alignSelf: 'stretch',
  },
  pickerWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    minHeight: 196,
  },
  applyBtn: {
    marginTop: spacing.sm,
  },
});
