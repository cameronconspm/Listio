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
  const todayString = toDateString(new Date());

  const styles = useMemo(
    () =>
      StyleSheet.create({
        scrollContent: {
          paddingTop: theme.spacing.xxs,
          paddingHorizontal: theme.spacing.md,
          paddingBottom: theme.spacing.xs,
        },
        dayChip: {
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.xs,
          borderRadius: theme.radius.full,
          minHeight: 44,
          justifyContent: 'center',
          alignItems: 'center',
        },
      }),
    [theme],
  );

  const selectedIndex = dates.findIndex((d) => toDateString(d) === selectedDateString);
  const hasScrolledToSelectionRef = useRef(false);

  /** Rough chip stride for scroll-to-selected (short weekday + date label). */
  const chipScrollStride = theme.spacing.md * 4 + theme.spacing.sm;

  useEffect(() => {
    if (selectedIndex >= 0 && scrollRef.current) {
      scrollRef.current.scrollTo({
        x: Math.max(0, selectedIndex * chipScrollStride - theme.spacing.xl),
        animated: hasScrolledToSelectionRef.current,
      });
      hasScrolledToSelectionRef.current = true;
    }
  }, [chipScrollStride, selectedIndex, theme.spacing.xl]);

  return (
    <View style={horizontalScrollInsetBleed(theme.spacing.md)}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {dates.map((d, i) => {
          const dateString = toDateString(d);
          const isSelected = dateString === selectedDateString;
          const isToday = dateString === todayString;

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
                isToday && !isSelected && {
                  borderWidth: 1,
                  borderColor: theme.accent + '55',
                },
              ]}
            >
              <Text
                style={[
                  theme.typography.footnote,
                  {
                    color: isSelected || isToday ? theme.accent : theme.textSecondary,
                    fontWeight: isSelected || isToday ? '600' : '400',
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
