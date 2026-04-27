import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/ThemeContext';
import { ZONE_LABELS, ZONE_ICONS } from '../../data/zone';
import { BottomSheet } from './BottomSheet';
import { ListSection } from './ListSection';
import { TextField } from './TextField';
import { PrimaryButton } from './PrimaryButton';
import type { AisleEntry, ZoneKey } from '../../types/models';
import { spacing } from '../../design/spacing';
import { radius } from '../../design/radius';

type EmojiPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (emoji: string, name?: string) => void;
  /** The store section row being edited */
  entry: AisleEntry | null;
};

/** Extract first emoji only. Returns empty if input has no valid emoji. */
function extractFirstEmoji(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  const match = trimmed.match(
    /[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier}\p{Emoji_Modifier_Base}\p{Emoji_Component}]/u
  );
  return match ? match[0]! : '';
}

/** True if string is a single valid emoji (and nothing else). */
function isSingleEmoji(input: string): boolean {
  if (!input || input.trim().length === 0) return false;
  const emoji = extractFirstEmoji(input);
  if (!emoji) return false;
  return input.trim() === emoji;
}

function getEntryLabel(entry: AisleEntry): string {
  if (entry.type === 'custom') return entry.name;
  return ZONE_LABELS[entry.key] ?? entry.key;
}

export function EmojiPickerSheet({
  visible,
  onClose,
  onSave,
  entry,
}: EmojiPickerSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [emojiValue, setEmojiValue] = useState('');
  const [nameValue, setNameValue] = useState('');
  const [emojiError, setEmojiError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const entryRef = useRef(entry);
  if (entry) entryRef.current = entry;
  const effectiveEntry = entry ?? entryRef.current;

  const isCustom = effectiveEntry != null && effectiveEntry.type === 'custom';
  const hasCustomIcon = !!(effectiveEntry?.icon ?? '');
  const defaultIconName =
    !effectiveEntry
      ? 'ellipsis-horizontal'
      : effectiveEntry.type === 'custom'
        ? 'pricetag-outline'
        : (ZONE_ICONS[effectiveEntry.key as ZoneKey] ?? 'ellipsis-horizontal');
  const displayEmoji = emojiValue || (effectiveEntry?.icon ?? '');

  useEffect(() => {
    if (visible && entry) {
      setEmojiValue(entry.icon ?? '');
      setNameValue(entry.type === 'custom' ? entry.name : getEntryLabel(entry));
      setEmojiError(null);
      setNameError(null);
      const t = setTimeout(() => inputRef.current?.focus(), 400);
      return () => clearTimeout(t);
    }
  }, [visible, entry, isCustom]);

  const handleChangeText = (t: string) => {
    const emoji = extractFirstEmoji(t);
    if (t.length > 0 && !emoji) {
      setEmojiError('One emoji only. No text, numbers, or symbols.');
      return;
    }
    setEmojiError(null);
    setEmojiValue(emoji);
  };

  const handleSave = () => {
    setEmojiError(null);
    setNameError(null);

    const trimmed = emojiValue.trim();
    if (trimmed && !isSingleEmoji(trimmed)) {
      setEmojiError('One emoji only. No text, numbers, or symbols.');
      return;
    }
    if (isCustom && !nameValue.trim()) {
      setNameError('Section name is required.');
      return;
    }
    const emoji = trimmed || '';
    const name = isCustom ? nameValue.trim() : undefined;
    onSave(emoji, name);
    onClose();
  };

  const handleUseDefault = () => {
    onSave('');
    onClose();
  };

  if (!effectiveEntry) {
    return null;
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} size="form">
      <View style={styles.sheetLayout}>
        {/* Header: matches Add item - title left, Save right */}
        <View style={styles.sheetHeader}>
          <Text style={[theme.typography.headline, { color: theme.textPrimary }]}>
            Edit section
          </Text>
          <TouchableOpacity
            onPress={handleSave}
            style={styles.headerSaveBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={[theme.typography.headline, { color: theme.accent }]}>
              Save
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={[
            styles.scrollContentInner,
            { paddingBottom: theme.spacing.lg + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
        >
          {/* SECTION NAME - matches ITEM section in Add item */}
          <ListSection title="Section" titleVariant="small" glass={false} style={styles.section}>
            {isCustom ? (
              <TextField
                label=""
                value={nameValue}
                onChangeText={(t) => {
                  setNameValue(t);
                  if (nameError) setNameError(null);
                }}
                placeholder="e.g. Produce, Pharmacy"
                error={nameError ?? undefined}
                containerStyle={styles.fieldWrap}
              />
            ) : (
              <View style={[styles.readOnlyField, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
                <Text style={[theme.typography.body, { color: theme.textPrimary }]}>
                  {getEntryLabel(effectiveEntry)}
                </Text>
              </View>
            )}
          </ListSection>

          {/* ICON - matches DETAILS section */}
          <ListSection title="Icon" titleVariant="small" glass={false} style={styles.section}>
            <View style={styles.iconRow}>
              <View
                style={[
                  styles.iconPreview,
                  { backgroundColor: theme.textSecondary + '15' },
                ]}
              >
                {displayEmoji ? (
                  <Text style={styles.iconPreviewEmoji}>{displayEmoji}</Text>
                ) : (
                  <Ionicons
                    name={defaultIconName as keyof typeof Ionicons.glyphMap}
                    size={22}
                    color={theme.textSecondary}
                  />
                )}
              </View>
              <TextInput
                ref={inputRef}
                value={emojiValue}
                onChangeText={handleChangeText}
                onSubmitEditing={handleSave}
                returnKeyType="done"
                autoFocus
                showSoftInputOnFocus
                placeholder="Tap to add custom emoji"
                placeholderTextColor={theme.textSecondary}
                style={[
                  theme.typography.body,
                  styles.emojiInput,
                  {
                    color: theme.textPrimary,
                    backgroundColor: theme.surface,
                    borderColor: emojiError ? theme.danger : theme.divider,
                  },
                ]}
              />
            </View>
            <Text
              style={[
                theme.typography.caption2,
                {
                  color: emojiError ? theme.danger : theme.textSecondary,
                  marginTop: theme.spacing.xs,
                },
              ]}
            >
              {emojiError ?? 'Use device emoji keyboard. One emoji only.'}
            </Text>
          </ListSection>

          {hasCustomIcon ? (
            <TouchableOpacity
              onPress={handleUseDefault}
              style={styles.defaultLink}
            >
              <Text style={[theme.typography.footnote, { color: theme.textSecondary }]}>
                Use default icon
              </Text>
            </TouchableOpacity>
          ) : null}

          <PrimaryButton
            title="Save"
            onPress={handleSave}
            style={styles.saveBtn}
          />
        </ScrollView>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetLayout: {
    flex: 1,
    minHeight: 0,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  headerSaveBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentInner: {
    paddingTop: 0,
  },
  section: {
    marginBottom: spacing.lg,
  },
  fieldWrap: {
    marginBottom: 0,
  },
  readOnlyField: {
    minHeight: 50,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.input,
    borderWidth: 1,
    justifyContent: 'center',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconPreview: {
    width: 44,
    height: 44,
    borderRadius: radius.input,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconPreviewEmoji: {
    fontSize: 24,
  },
  emojiInput: {
    flex: 1,
    minHeight: 50,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.input,
    borderWidth: 1,
    fontSize: 18,
  },
  defaultLink: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  saveBtn: {
    minHeight: 50,
    marginTop: spacing.sm,
  },
});
