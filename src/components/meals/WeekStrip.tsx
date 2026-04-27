import React, { useRef, useEffect, useMemo } from 'react';
import { View, ScrollView, Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../../design/ThemeContext';
import { horizontalScrollInsetBleed } from '../../design/layout';
import { formatDayShortWithDate, toDateString } from '../../utils/dateUtils';

type WeekStripProps = {
  dates: Date[];
  selectedDateString: string;
  onSelectDate: (dateString: string) => void;
};

export function WeekStrip({ dates, selectedDateString, onSelectDate }: WeekStripProps) {
  const theme = useTheme();
  const scrollRef = useRef<ScrollView>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        scrollContent: {
          paddingTop: theme.spacing.xxs,
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing.xs,
        },
        dayChip: {
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          borderRadius: theme.radius.full,
          minHeight: 36,
          justifyContent: 'center',
          alignItems: 'center',
        },
      }),
    [theme],
  );

  const selectedIndex = dates.findIndex((d) => toDateString(d) === selectedDateString);

  useEffect(() => {
    if (selectedIndex >= 0 && scrollRef.current) {
      scrollRef.current.scrollTo({
        x: Math.max(0, selectedIndex * 70 - 80),
        animated: true,
      });
    }
  }, [selectedIndex]);

  return (
    <View style={horizontalScrollInsetBleed(theme.spacing.lg)}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {dates.map((d, i) => {
          const dateString = toDateString(d);
          const isSelected = dateString === selectedDateString;

          return (
            <Pressable
              key={dateString}
              onPress={() => onSelectDate(dateString)}
              style={[
                styles.dayChip,
                i < dates.length - 1 && { marginRight: theme.spacing.sm },
                {
                  backgroundColor: isSelected ? theme.accent + '12' : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  theme.typography.footnote,
                  {
                    color: isSelected ? theme.accent : theme.textSecondary,
                    fontWeight: isSelected ? '600' : '400',
                  },
                ]}
              >
                {formatDayShortWithDate(d)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
