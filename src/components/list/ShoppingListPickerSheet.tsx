import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../design/ThemeContext';
import { BottomSheet } from '../ui/BottomSheet';
import { TextField } from '../ui/TextField';
import { PrimaryButton } from '../ui/PrimaryButton';
import { spacing } from '../../design/spacing';
import {
  createShoppingList,
  fetchShoppingLists,
  setActiveShoppingListId,
} from '../../services/shoppingListService';
import type { ShoppingList } from '../../types/models';
import { useInvalidateHomeList } from '../../hooks/useInvalidateHomeList';

type ShoppingListPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  activeListId: string | null;
  onActiveListChange: (listId: string) => void;
};

export function ShoppingListPickerSheet({
  visible,
  onClose,
  activeListId,
  onActiveListChange,
}: ShoppingListPickerSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const invalidateHomeList = useInvalidateHomeList();
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [newListName, setNewListName] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchShoppingLists();
      setLists(rows);
    } catch (e) {
      Alert.alert('Could not load lists', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) void load();
  }, [visible, load]);

  const selectList = async (listId: string) => {
    try {
      await setActiveShoppingListId(listId);
      onActiveListChange(listId);
      invalidateHomeList();
      onClose();
    } catch (e) {
      Alert.alert('Could not switch list', e instanceof Error ? e.message : 'Unknown error');
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const created = await createShoppingList(newListName);
      setNewListName('');
      await setActiveShoppingListId(created.id);
      onActiveListChange(created.id);
      invalidateHomeList();
      onClose();
    } catch (e) {
      Alert.alert('Could not create list', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      size="form"
      formHugContent
      compactHeader
      surfaceVariant="solid"
      presentationVariant="form"
      keyboardOverlay
    >
      <View style={{ paddingBottom: Math.max(insets.bottom, theme.spacing.md) }}>
        <Text
          style={[
            theme.typography.headline,
            { color: theme.textPrimary, marginBottom: theme.spacing.sm },
          ]}
        >
          Your lists
        </Text>
        {loading ? (
          <Text style={[theme.typography.body, { color: theme.textSecondary }]}>Loading…</Text>
        ) : (
          <View
            style={[styles.listWrap, { borderRadius: theme.radius.card, backgroundColor: theme.surfaceRaised }]}
          >
            {lists.map((list, index) => {
              const selected = list.id === activeListId || (activeListId == null && list.is_default);
              return (
                <Pressable
                  key={list.id}
                  onPress={() => void selectList(list.id)}
                  style={({ pressed }) => [
                    styles.row,
                    { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[theme.typography.body, { color: theme.textPrimary }]} numberOfLines={1}>
                      {list.name}
                    </Text>
                    {list.is_default ? (
                      <Text style={[theme.typography.footnote, { color: theme.textSecondary }]}>
                        Main list
                      </Text>
                    ) : null}
                  </View>
                  {selected ? <Ionicons name="checkmark-circle" size={22} color={theme.accent} /> : null}
                  {index < lists.length - 1 ? (
                    <View
                      style={[
                        StyleSheet.absoluteFillObject,
                        styles.separator,
                        { backgroundColor: theme.divider, top: undefined, bottom: 0, height: StyleSheet.hairlineWidth },
                      ]}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        )}
        <View style={styles.createSection}>
          <TextField
            label="New list name"
            value={newListName}
            onChangeText={setNewListName}
            placeholder="Costco, Party, etc."
            containerStyle={{ marginBottom: theme.spacing.sm }}
          />
          <PrimaryButton
            title="Create list"
            onPress={() => void handleCreate()}
            loading={creating}
            disabled={!newListName.trim()}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  listWrap: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  separator: { left: 16, right: 0 },
  createSection: { marginTop: spacing.md },
});
