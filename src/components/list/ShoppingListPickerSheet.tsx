import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../design/ThemeContext';
import { useAuthUserId } from '../../context/AuthContext';
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
import { fetchHomeListBundle, HOME_LIST_STALE_MS } from '../../query/homeListBundle';
import { queryKeys } from '../../query/keys';

type ShoppingListPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  activeListId: string | null;
  /** Lists already loaded on the home screen — shown immediately when the sheet opens. */
  lists: ShoppingList[];
  onListsChange: (lists: ShoppingList[]) => void;
  onActiveListChange: (listId: string) => void;
};

export function ShoppingListPickerSheet({
  visible,
  onClose,
  activeListId,
  lists,
  onListsChange,
  onActiveListChange,
}: ShoppingListPickerSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const userId = useAuthUserId();
  const queryClient = useQueryClient();
  const invalidateHomeList = useInvalidateHomeList();
  const [newListName, setNewListName] = useState('');
  const [creating, setCreating] = useState(false);

  const refreshListsSilently = useCallback(async () => {
    try {
      const rows = await fetchShoppingLists();
      onListsChange(rows);
    } catch {
      // keep showing cached lists from props
    }
  }, [onListsChange]);

  useEffect(() => {
    if (!visible) return;
    void refreshListsSilently();
  }, [visible, refreshListsSilently]);

  const selectList = async (listId: string) => {
    onActiveListChange(listId);
    onClose();
    try {
      await setActiveShoppingListId(listId);
      if (typeof userId === 'string' && userId) {
        await queryClient.prefetchQuery({
          queryKey: queryKeys.homeList(userId, listId),
          queryFn: () => fetchHomeListBundle(userId, queryClient, listId),
          staleTime: HOME_LIST_STALE_MS,
        });
      }
      invalidateHomeList();
    } catch (e) {
      Alert.alert('Could not switch list', e instanceof Error ? e.message : 'Unknown error');
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const created = await createShoppingList(newListName);
      setNewListName('');
      await refreshListsSilently();
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
      keyboardLift="reanimated"
      onExitAnimationStart={() => {
        Keyboard.dismiss();
      }}
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
