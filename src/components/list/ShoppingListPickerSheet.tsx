import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, Keyboard, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../design/ThemeContext';
import { useAuthUserId } from '../../context/AuthContext';
import { BottomSheet } from '../ui/BottomSheet';
import { TextField } from '../ui/TextField';
import { PrimaryButton } from '../ui/PrimaryButton';
import { Button } from '../ui/Button';
import { HeaderIconButton } from '../ui/HeaderIconButton';
import { AppActionSheet, type AppActionSheetAction } from '../ui/AppActionSheet';
import { AppConfirmationDialog } from '../ui/AppConfirmationDialog';
import { spacing } from '../../design/spacing';
import {
  createShoppingList,
  deleteShoppingList,
  fetchShoppingLists,
  renameShoppingList,
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

function resolveFallbackActiveListId(lists: ShoppingList[], deletedId: string): string | null {
  const remaining = lists.filter((list) => list.id !== deletedId);
  if (remaining.length === 0) return null;
  return remaining.find((list) => list.is_default)?.id ?? remaining[0]?.id ?? null;
}

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
  const [manageList, setManageList] = useState<ShoppingList | null>(null);
  const [renameTarget, setRenameTarget] = useState<ShoppingList | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ShoppingList | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refreshListsSilently = useCallback(async () => {
    try {
      const rows = await fetchShoppingLists();
      onListsChange(rows);
      return rows;
    } catch {
      return lists;
    }
  }, [lists, onListsChange]);

  useEffect(() => {
    if (!visible) return;
    void refreshListsSilently();
  }, [visible, refreshListsSilently]);

  useEffect(() => {
    if (!visible) {
      setManageList(null);
      setRenameTarget(null);
      setRenameValue('');
      setDeleteTarget(null);
    }
  }, [visible]);

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

  const openRename = useCallback((list: ShoppingList) => {
    setRenameTarget(list);
    setRenameValue(list.name);
  }, []);

  const handleRename = async () => {
    if (!renameTarget) return;
    setRenaming(true);
    try {
      const updated = await renameShoppingList(renameTarget.id, renameValue);
      const nextLists = lists.map((list) => (list.id === updated.id ? updated : list));
      onListsChange(nextLists);
      setRenameTarget(null);
      setRenameValue('');
    } catch (e) {
      Alert.alert('Could not rename list', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setRenaming(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return;
    const deletedId = deleteTarget.id;
    const wasActive =
      deletedId === activeListId || (activeListId == null && deleteTarget.is_default);
    setDeleting(true);
    try {
      await deleteShoppingList(deletedId);
      const refreshed = await refreshListsSilently();
      const nextLists = Array.isArray(refreshed) ? refreshed : lists.filter((l) => l.id !== deletedId);
      onListsChange(nextLists);

      if (typeof userId === 'string' && userId) {
        queryClient.removeQueries({ queryKey: queryKeys.homeList(userId, deletedId) });
      }

      if (wasActive) {
        const fallbackId = resolveFallbackActiveListId(nextLists, deletedId);
        if (fallbackId) {
          onActiveListChange(fallbackId);
          await setActiveShoppingListId(fallbackId);
          if (typeof userId === 'string' && userId) {
            await queryClient.prefetchQuery({
              queryKey: queryKeys.homeList(userId, fallbackId),
              queryFn: () => fetchHomeListBundle(userId, queryClient, fallbackId),
              staleTime: HOME_LIST_STALE_MS,
            });
          }
        }
      }

      invalidateHomeList();
      setDeleteTarget(null);
    } catch (e) {
      Alert.alert('Could not delete list', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setDeleting(false);
    }
  };

  const manageActions = useMemo((): AppActionSheetAction[] => {
    if (!manageList) return [];
    const actions: AppActionSheetAction[] = [
      {
        label: 'Rename list',
        onPress: () => openRename(manageList),
      },
    ];
    if (!manageList.is_default && lists.length > 1) {
      actions.push({
        label: 'Delete list',
        destructive: true,
        onPress: () => setDeleteTarget(manageList),
      });
    }
    return actions;
  }, [lists.length, manageList, openRename]);

  return (
    <>
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
            style={[
              styles.listWrap,
              { borderRadius: theme.radius.card, backgroundColor: theme.surfaceRaised },
            ]}
          >
            {lists.map((list, index) => {
              const selected =
                list.id === activeListId || (activeListId == null && list.is_default);
              return (
                <View
                  key={list.id}
                  style={[
                    styles.row,
                    { paddingLeft: theme.spacing.md, paddingVertical: theme.spacing.xs },
                  ]}
                >
                  <Pressable
                    onPress={() => void selectList(list.id)}
                    style={({ pressed }) => [
                      styles.rowBody,
                      { paddingVertical: theme.spacing.xs, paddingRight: theme.spacing.xs },
                      pressed && { opacity: 0.7 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Switch to ${list.name}`}
                    accessibilityState={{ selected }}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={[theme.typography.body, { color: theme.textPrimary }]}
                        numberOfLines={1}
                      >
                        {list.name}
                      </Text>
                      {list.is_default ? (
                        <Text style={[theme.typography.footnote, { color: theme.textSecondary }]}>
                          Main list
                        </Text>
                      ) : null}
                    </View>
                    {selected ? (
                      <Ionicons name="checkmark-circle" size={22} color={theme.accent} />
                    ) : null}
                  </Pressable>
                  <HeaderIconButton
                    accessibilityLabel={`Manage ${list.name}`}
                    accessibilityHint="Rename or delete this list"
                    onPress={() => setManageList(list)}
                  >
                    <Ionicons name="ellipsis-horizontal" size={20} color={theme.textSecondary} />
                  </HeaderIconButton>
                  {index < lists.length - 1 ? (
                    <View
                      style={[
                        StyleSheet.absoluteFillObject,
                        styles.separator,
                        {
                          backgroundColor: theme.divider,
                          top: undefined,
                          bottom: 0,
                          height: StyleSheet.hairlineWidth,
                        },
                      ]}
                    />
                  ) : null}
                </View>
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

      <AppActionSheet
        visible={manageList != null}
        onClose={() => setManageList(null)}
        title={manageList?.name}
        message="Rename or delete this list"
        actions={manageActions}
      />

      <Modal
        visible={renameTarget != null}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameTarget(null)}
      >
        <Pressable style={styles.renameBackdrop} onPress={() => setRenameTarget(null)}>
          <Pressable
            style={[
              styles.renameCard,
              {
                backgroundColor: theme.surface,
                borderRadius: theme.radius.xl,
                padding: theme.spacing.lg,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text
              style={[
                theme.typography.headline,
                { color: theme.textPrimary, marginBottom: theme.spacing.md },
              ]}
            >
              Rename list
            </Text>
            <TextField
              label="List name"
              value={renameValue}
              onChangeText={setRenameValue}
              autoFocus
              containerStyle={{ marginBottom: theme.spacing.md }}
            />
            <View style={styles.renameActions}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setRenameTarget(null)}
                disabled={renaming}
                style={{ flex: 1 }}
              />
              <PrimaryButton
                title="Save"
                onPress={() => void handleRename()}
                loading={renaming}
                disabled={!renameValue.trim()}
                style={{ flex: 1 }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <AppConfirmationDialog
        visible={deleteTarget != null}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        title="Delete list?"
        message={
          deleteTarget
            ? `"${deleteTarget.name}" and all of its items will be removed. This cannot be undone.`
            : undefined
        }
        buttons={[
          { label: 'Cancel', onPress: () => {}, cancel: true },
          {
            label: deleting ? 'Deleting…' : 'Delete list',
            destructive: true,
            onPress: () => void handleDelete(),
          },
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  listWrap: { overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    position: 'relative',
  },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  separator: { left: 16, right: 0 },
  createSection: { marginTop: spacing.md },
  renameBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  renameCard: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  renameActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
