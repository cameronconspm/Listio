import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useQuery, useQueryClient, useIsRestoring } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import { useNavigationChromeScroll } from '../../navigation/NavigationChromeScrollContext';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../design/ThemeContext';
import { tabRootScrollPaddingTop } from '../../design/layout';
import { Screen } from '../../components/ui/Screen';
import {
  AppConfirmationDialog,
  type AppConfirmationButton,
} from '../../components/ui/AppConfirmationDialog';
import { useHaptics } from '../../hooks/useHaptics';
import { useShoppingMode } from '../../hooks/useShoppingMode';
import { getUserId } from '../../services/supabaseClient';
import { useAuthUserId } from '../../context/AuthUserIdContext';
import { getMealsByIds } from '../../services/mealService';
import { linkedMealRowMeta, type LinkedMealRowMeta } from '../../utils/mealLabel';
import { getZoneIconOverrides } from '../../utils/storeUtils';
import { DEFAULT_ZONE_ORDER, ZONE_LABELS } from '../../data/zone';
import { useDebounce } from '../../hooks/useDebounce';
import {
  fetchUserPreferences,
  patchUserPreferencesIfSync,
} from '../../services/userPreferencesService';
import { QuickAddComposer } from '../../components/list/QuickAddComposer';
import type { QuickAddComposerHandle } from '../../components/list/QuickAddComposer';
import type { ListItem, ZoneKey, StoreProfile } from '../../types/models';
import {
  BottomQuickAddBar,
  bottomQuickAddClearance,
  type BottomQuickAddBarHandle,
} from '../../components/list/BottomQuickAddBar';
import { ITEM_NAME_SUGGESTION_UI_CAP } from '../../services/itemNameSuggestions';
import { putCachedCategories, seedCategoryCacheFromListItems } from '../../services/aiCategoryCache';
import { normalize, toBoolean } from '../../utils/normalize';
import type { ParsedItem } from '../../utils/parseItems';
import { findDuplicate, type DuplicateMatch } from '../../utils/duplicateDetection';
import type { CategorizeItemResult, ParsedListItem } from '../../types/api';
import { normalizePersistedZoneOrder } from '../../utils/zoneOrderPrefs';
import { showError } from '../../utils/appToast';
import { isPendingListItemId } from '../../utils/listItemPending';
import { ListActionsSheet } from '../../components/list/ListActionsSheet';
import { AppActionSheet } from '../../components/ui/AppActionSheet';
import { ListScreenHeader } from '../../components/list/ListScreenHeader';
import { recordItemAdded } from '../../services/recentItemsStore';
import { useReduceMotion } from '../../ui/motion/useReduceMotion';
import { useFabExpandScrollHandler } from '../../hooks/useFabExpandScrollHandler';
import { useHomeListMutations } from '../../hooks/useHomeListMutations';
import { useLazyMount } from '../../hooks/useLazyMount';
import { queryKeys } from '../../query/keys';
import { fetchHomeListBundle, HOME_LIST_STALE_MS } from '../../query/homeListBundle';
import { prefetchRecipesAndDefaultMealsRange } from '../../query/prefetchAdjacentTabs';
import {
  deriveHomeListModel,
  safeZoneOrderOrDefault,
  shareHomeListDerivedModel,
  type HomeListDerivedModel,
  type HomeSectionItem,
} from './homeScreenListDerived';
import { HomeScreenEmptyState } from './HomeScreenEmptyState';
import { HomeScreenZoneList } from './HomeScreenZoneList';
import { ShopRunCompleteOverlay } from '../../components/list/ShopRunCompleteOverlay';
import { markRender, time, timeAsync } from '../../utils/perf';
import { notifyListItemsForMilestones } from '../../firstLaunchTour/milestoneUnlockFlow';
import { ensureFreeTierCapacity } from '../../services/freeTierLimits';
import { usePremiumEntitlement } from '../../context/PremiumEntitlementContext';
import { useAppReview } from '../../context/AppReviewContext';

const VALID_LIST_ZONES = new Set<ZoneKey>(DEFAULT_ZONE_ORDER);

/** Stable empty array so `listQuery.data?.listItems ?? EMPTY_ITEMS` does not
 *  allocate a fresh reference every render. */
const EMPTY_ITEMS: readonly ListItem[] = Object.freeze([]);

/** Zone icon overrides keyed to `null` (no store) never change — hoist so the
 *  derived model does not re-allocate on every render. */
const DEFAULT_ZONE_ICON_OVERRIDES = getZoneIconOverrides(null);

type ListDeleteDialogState =
  | { kind: 'item'; id: string }
  | { kind: 'all' }
  | { kind: 'zone'; zoneKey: ZoneKey }
  | null;

/** Options for `handleComposerSubmit` / bottom quick-add (see `onOptimisticListInsert`). */
type ComposerSubmitOptions = {
  onOptimisticListInsert?: () => void;
};

export function HomeScreen() {
  if (__DEV__) markRender('HomeScreen');
  const theme = useTheme();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { isPremium } = usePremiumEntitlement();
  const { maybePromptForReview } = useAppReview();
  const scrollTopBelowTabHeader = tabRootScrollPaddingTop(insets.top, theme.spacing);
  const tabBarHeight = useBottomTabBarHeight();
  const haptics = useHaptics();
  const reduceMotion = useReduceMotion();
  const composerRef = useRef<QuickAddComposerHandle>(null);
  const bottomAddBarRef = useRef<BottomQuickAddBarHandle>(null);
  const sectionsRef = useRef<HomeSectionItem[]>([]);
  const itemsRef = useRef<ListItem[]>([]);
  const previousDerivedRef = useRef<HomeListDerivedModel | null>(null);
  const { scrollY: tabScrollY } = useNavigationChromeScroll();
  const listScrollShared = tabScrollY.ListTab;
  const { listScrollHandler } = useFabExpandScrollHandler(listScrollShared);
  const [refreshing, setRefreshing] = useState(false);
  /** undefined = getUserId not resolved yet; null = not signed in. */
  const userId = useAuthUserId();
  const [composerVisible, setComposerVisible] = useState(false);
  const [listDeleteDialog, setListDeleteDialog] = useState<ListDeleteDialogState>(null);
  const [editingItem, setEditingItem] = useState<ListItem | null>(null);
  const [zoneOrder, setZoneOrder] = useState<ZoneKey[]>(DEFAULT_ZONE_ORDER);
  const [collapsedZones, setCollapsedZones] = useState<Set<ZoneKey>>(new Set());
  const [filterZone, setFilterZone] = useState<ZoneKey | 'all'>('all');
  const [shoppingMode, setShoppingMode, { isHydrated: shoppingModeHydrated }] = useShoppingMode();

  const [reorderMode, setReorderMode] = useState(false);
  const [sessionZoneOrder, setSessionZoneOrder] = useState<ZoneKey[] | null>(null);
  const [reorderSections, setReorderSections] = useState<HomeSectionItem[]>([]);
  const [listActionsVisible, setListActionsVisible] = useState(false);
  /** Long-press section header: wiggle + delete affordance; cleared by Done/Cancel or after zone delete. */
  const [zoneClearMode, setZoneClearMode] = useState<ZoneKey | null>(null);
  const [shopRunCompleteVisible, setShopRunCompleteVisible] = useState(false);
  const [shopRunCompleteStats, setShopRunCompleteStats] = useState<{
    totalItems: number;
    aisleCount: number;
  } | null>(null);
  const shopRunCompleteGateRef = useRef(false);
  /** Set when user chooses “Delete entire list”; confirmation opens in `onDismissed` after the sheet modal exits. */
  const pendingDeleteEntireListAfterSheetRef = useRef(false);
  const [reorderSaveSheetVisible, setReorderSaveSheetVisible] = useState(false);
  const [reorderSaveOrder, setReorderSaveOrder] = useState<ZoneKey[] | null>(null);
  const [duplicateResolution, setDuplicateResolution] = useState<{
    match: DuplicateMatch;
    incoming: ParsedItem;
    categorized: { normalized_name: string; category: string; zone_key: string };
  } | null>(null);
  /** Lazy-mount gates: sheets/dialogs stay unmounted until first opened to avoid mount cost on screen load. */
  const composerMounted = useLazyMount(composerVisible);
  const listActionsMounted = useLazyMount(listActionsVisible);
  const reorderSaveSheetMounted = useLazyMount(reorderSaveSheetVisible);
  const listDeleteDialogMounted = useLazyMount(listDeleteDialog != null);
  const duplicateResolutionMounted = useLazyMount(duplicateResolution != null);
  /** Staged duplicate: show centered alert only after the composer sheet modal has fully exited (avoids stacked RN Modals freezing touches). */
  const pendingDuplicateAfterComposerRef = useRef<{
    match: DuplicateMatch;
    incoming: ParsedItem;
    categorized: { normalized_name: string; category: string; zone_key: string };
  } | null>(null);
  const [linkedMealLabels, setLinkedMealLabels] = useState<Map<string, LinkedMealRowMeta>>(
    () => new Map()
  );
  const lastPlaceholderIndexRef = useRef<number | null>(null);
  const listPrefsLoaded = useRef(false);
  /** Restore section expand/collapse after inline reorder finishes. */
  const collapsedSnapshotRef = useRef<Set<ZoneKey> | null>(null);

  const isRestoringCache = useIsRestoring();

  const listQuery = useQuery({
    queryKey: queryKeys.homeList(userId ?? ''),
    queryFn: () => fetchHomeListBundle(userId!, queryClient),
    enabled: typeof userId === 'string' && userId.length > 0,
    staleTime: HOME_LIST_STALE_MS,
  });

  const userReady = typeof userId === 'string' && userId.length > 0;
  const listAwaitingFirstPayload =
    userReady && listQuery.data === undefined && (listQuery.isPending || isRestoringCache);
  const listBlocking = userId === undefined || listAwaitingFirstPayload;

  /**
   * Prefetch Recipes + default Meals window after list loads (tabs open without cold fetches).
   * Guarded to fire once per user session so invalidations of the home list don't re-trigger
   * adjacent-tab prefetches.
   */
  const prefetchedForUserRef = useRef<string | null>(null);
  useEffect(() => {
    if (typeof userId !== 'string' || !userId || !listQuery.isSuccess) return;
    if (prefetchedForUserRef.current === userId) return;
    prefetchedForUserRef.current = userId;
    prefetchRecipesAndDefaultMealsRange(userId, queryClient);
  }, [userId, listQuery.isSuccess, queryClient]);

  const {
    insertItems,
    updateItem,
    toggleItem,
    removeItem,
    removeAllItems,
    removeZoneItems,
    removeCheckedItems,
  } = useHomeListMutations();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = await fetchUserPreferences();
      if (cancelled) return;
      const lz = p.listUi;
      if (
        lz?.filterZone === 'all' ||
        (lz?.filterZone && VALID_LIST_ZONES.has(lz.filterZone as ZoneKey))
      ) {
        setFilterZone(lz.filterZone as ZoneKey | 'all');
      }
      if (lz?.collapsedZoneKeys?.length) {
        const collapsed = lz.collapsedZoneKeys.filter((k): k is ZoneKey =>
          VALID_LIST_ZONES.has(k as ZoneKey)
        );
        if (collapsed.length) setCollapsedZones(new Set(collapsed));
      }
      const zo = normalizePersistedZoneOrder(lz?.zoneOrder);
      if (zo) setZoneOrder(zo);
      listPrefsLoaded.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const debouncedPersistListUi = useDebounce(() => {
    if (!listPrefsLoaded.current) return;
    patchUserPreferencesIfSync({
      listUi: {
        collapsedZoneKeys: [...collapsedZones],
        filterZone,
      },
    });
  }, 500);

  useEffect(() => {
    debouncedPersistListUi();
  }, [collapsedZones, filterZone, debouncedPersistListUi]);

  const items = (listQuery.data?.listItems ?? EMPTY_ITEMS) as ListItem[];
  const store: StoreProfile | null = listQuery.data?.store ?? null;
  itemsRef.current = items;

  const listItemNames = useMemo(
    () => items.map((item) => item.name).filter((name) => name.trim().length > 0),
    [items]
  );

  const categorySeedSignature = useMemo(
    () =>
      items
        .map((item) => `${item.normalized_name}|${item.zone_key}|${item.category}`)
        .join('\n'),
    [items]
  );

  useEffect(() => {
    if (!categorySeedSignature) return;
    const id = setTimeout(() => {
      seedCategoryCacheFromListItems(
        items.map((item) => ({
          normalized_name: item.normalized_name,
          zone_key: item.zone_key,
          category: item.category,
        }))
      );
    }, 400);
    return () => clearTimeout(id);
  }, [categorySeedSignature, items]);

  /**
   * Keying the linked-meals fetch on the full `listItems` reference would refire
   * on every optimistic toggle/edit (since react-query hands us a new array each
   * mutation). Dedupe via a stable id signature so the fetch only reruns when
   * the *set* of linked meal ids actually changes.
   */
  const linkedMealIdsSignature = useMemo(() => {
    const listData = listQuery.data?.listItems;
    if (!listData) return '';
    const ids = new Set<string>();
    for (const i of listData) {
      const linked = i.linked_meal_ids;
      if (!linked) continue;
      for (const id of linked) ids.add(id);
    }
    if (ids.size === 0) return '';
    return Array.from(ids).sort().join(',');
  }, [listQuery.data?.listItems]);

  useEffect(() => {
    if (!linkedMealIdsSignature) {
      setLinkedMealLabels((prev) => (prev.size === 0 ? prev : new Map()));
      return;
    }
    const mealIds = linkedMealIdsSignature.split(',');
    let cancelled = false;
    void getMealsByIds(mealIds).then((meals) => {
      if (cancelled) return;
      const map = new Map<string, LinkedMealRowMeta>();
      for (const m of meals) {
        map.set(m.id, linkedMealRowMeta(m));
      }
      setLinkedMealLabels(map);
    });
    return () => {
      cancelled = true;
    };
  }, [linkedMealIdsSignature]);

  useEffect(() => {
    if (listQuery.isError) {
      showError('Could not refresh your list.');
    }
  }, [listQuery.isError]);

  useFocusEffect(
    useCallback(() => {
      if (typeof userId === 'string' && userId.length > 0) {
        const state = queryClient.getQueryState(queryKeys.homeList(userId));
        const updatedAt = state?.dataUpdatedAt ?? 0;
        if (Date.now() - updatedAt > HOME_LIST_STALE_MS) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.homeList(userId) });
        }
      }
      return () => {
        setZoneClearMode(null);
      };
    }, [userId, queryClient])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void listQuery.refetch().finally(() => setRefreshing(false));
  }, [listQuery]);

  const openComposerForEdit = useCallback(
    (item: ListItem) => {
      if (isPendingListItemId(item.id)) return;
      haptics.light();
      setZoneClearMode(null);
      setEditingItem(item);
      setComposerVisible(true);
    },
    [haptics]
  );

  const handleComposerSubmit = useCallback(
    async (parsedItems: ParsedItem[], zoneOverride: ZoneKey | null, opts?: ComposerSubmitOptions) => {
      const userId = await getUserId();
      if (!userId) throw new Error('Not signed in');
      const storeType = store?.store_type ?? 'generic';
      const zoneLabelsInOrder = (sessionZoneOrder ?? safeZoneOrderOrDefault(zoneOrder)).map(
        (k) => ZONE_LABELS[k]
      );

      // Single-item path: resolve the category before inserting so the row never
      // flashes in "Other" and then moves later.
      // `categorizeItems` still hits the local cache synchronously when available,
      // so repeat items keep the fast path without sacrificing correct placement.
      if (parsedItems.length === 1) {
        const p = parsedItems[0];
        const { categorizeItems, phraseKeyForCategorize } = await import('../../services/aiService');
        const displayName = p.name.trim();
        const stableKey = phraseKeyForCategorize(p.name);
        let categorized: { normalized_name: string; category: string; zone_key: string };
        if (zoneOverride == null) {
          const res = await categorizeItems([p.name], storeType, zoneLabelsInOrder);
          const first = res.results[0];
          if (!first) {
            throw new Error('Could not categorize item. Try again.');
          }
          categorized = first;
        } else {
          categorized = {
            normalized_name: stableKey,
            category: 'uncategorized',
            zone_key: zoneOverride,
          };
        }
        const resolvedZone: ZoneKey = zoneOverride ?? (categorized.zone_key as ZoneKey);
        const resolvedCategory = categorized.category;

        const match = findDuplicate(items, p);
        if (match) {
          haptics.light();
          pendingDuplicateAfterComposerRef.current = {
            match,
            incoming: p,
            categorized: {
              normalized_name: stableKey,
              category: resolvedCategory,
              zone_key: resolvedZone,
            },
          };
          setComposerVisible(false);
          setEditingItem(null);
          const err = new Error('Duplicate item');
          (err as { code?: string }).code = 'DUPLICATE';
          throw err;
        }

        const okSingle = await ensureFreeTierCapacity('list', items.length, 1, isPremium);
        if (!okSingle) {
          setComposerVisible(false);
          setEditingItem(null);
          return;
        }

        const singleInsertItem = {
          user_id: userId,
          name: displayName,
          normalized_name: stableKey,
          category: resolvedCategory,
          zone_key: resolvedZone,
          quantity_value: p.quantity ?? null,
          quantity_unit: p.unit ?? null,
          notes: p.note ?? null,
          is_checked: false,
          linked_meal_ids: [],
          brand_preference: p.brand_preference ?? null,
          substitute_allowed: p.substitute_allowed ?? true,
          priority: p.priority ?? 'normal',
          is_recurring: p.is_recurring ?? false,
        };

        if (opts?.onOptimisticListInsert) {
          const onListInsert = opts.onOptimisticListInsert;
          await timeAsync('homeInsertSingleItem', async () => {
            await new Promise<void>((resolve, reject) => {
              let barDone = false;
              const finishBar = () => {
                if (barDone) return;
                barDone = true;
                onListInsert();
                resolve();
              };
              insertItems.mutate(
                {
                  userId,
                  items: [singleInsertItem],
                  onOptimisticApplied: () => {
                    finishBar();
                  },
                },
                {
                  onSuccess: () => {
                    if (!barDone) finishBar();
                  },
                  onError: (e) => {
                    const msg = e instanceof Error ? e.message : String(e);
                    const short = msg.length > 140 ? `${msg.slice(0, 140)}…` : msg;
                    showError(short, 'Could not add item');
                    if (!barDone) {
                      reject(e instanceof Error ? e : new Error(msg));
                    }
                  },
                }
              );
            });
          });
          try {
            await recordItemAdded(stableKey, displayName, p.unit);
          } catch {
            // Recent-items cache is non-fatal
          }
          return;
        }

        await timeAsync('homeInsertSingleItem', () =>
          insertItems.mutateAsync({
            userId,
            items: [singleInsertItem],
          })
        );

        try {
          await recordItemAdded(stableKey, displayName, p.unit);
        } catch {
          // Recent-items cache is non-fatal
        }
        setComposerVisible(false);
        setEditingItem(null);
        return;
      }

      // Multi-item path: keep today's synchronous categorize → bulk insert flow.
      // Users who paste a multi-line list expect all rows to land pre-sorted; the
      // brief AI wait here is tolerable and matches the Smart Add review flow.
      const okMulti = await ensureFreeTierCapacity('list', items.length, parsedItems.length, isPremium);
      if (!okMulti) {
        setComposerVisible(false);
        setEditingItem(null);
        return;
      }
      const rawNames = parsedItems.map((p) => p.name);
      const { categorizeItems, phraseKeyForCategorize } = await import('../../services/aiService');
      let results: CategorizeItemResult[];
      try {
        const res = await categorizeItems(rawNames, storeType, zoneLabelsInOrder);
        results = res.results;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        showError(msg.length > 140 ? `${msg.slice(0, 140)}…` : msg, 'Could not auto-categorize');
        results = rawNames.map((name) => ({
          input: name,
          normalized_name: normalize(name) || name,
          category: 'other',
          zone_key: 'other',
          confidence: 0,
        }));
      }

      if (zoneOverride !== null) {
        results = results.map((r) => ({
          ...r,
          zone_key: zoneOverride,
        }));
      }

      await timeAsync('homeInsertMultipleItems', () =>
        insertItems.mutateAsync({
          userId,
          items: results.map((r, i) => {
            const p = parsedItems[i];
            const displayName = (p?.name ?? r.input).trim();
            const stableKey = phraseKeyForCategorize(p?.name ?? r.input);
            return {
              user_id: userId,
              name: displayName || stableKey,
              normalized_name: stableKey,
              category: r.category,
              zone_key: r.zone_key as ZoneKey,
              quantity_value: p?.quantity ?? null,
              quantity_unit: p?.unit ?? null,
              notes: p?.note ?? null,
              is_checked: false,
              linked_meal_ids: [],
              brand_preference: p?.brand_preference ?? null,
              substitute_allowed: p?.substitute_allowed ?? true,
              priority: p?.priority ?? 'normal',
              is_recurring: p?.is_recurring ?? false,
            };
          }),
        })
      );
      try {
        await Promise.all(
          parsedItems.map((_, i) =>
            recordItemAdded(
              phraseKeyForCategorize(parsedItems[i]?.name ?? results[i].input),
              parsedItems[i]?.name ?? results[i].input,
              parsedItems[i]?.unit
            )
          )
        );
      } catch {
        // Recent-items cache is non-fatal
      }
      setComposerVisible(false);
      setEditingItem(null);
    },
    [insertItems, items, zoneOrder, sessionZoneOrder, store, haptics, isPremium]
  );

  /**
   * Bulk-insert items that were already parsed + categorized by the Smart Add AI flow.
   * Unlike `handleComposerSubmit`, we do NOT re-run `categorizeItems` here — the user just
   * reviewed the zones in the Smart Add review sheet, so running categorize again could
   * disagree with what they saw, and would cost a second round-trip for zero gain.
   */
  const handleBulkAddPreCategorized = useCallback(
    async (preCategorized: ParsedListItem[]) => {
      if (preCategorized.length === 0) return;
      const userId = await getUserId();
      if (!userId) throw new Error('Not signed in');
      const okBulk = await ensureFreeTierCapacity('list', items.length, preCategorized.length, isPremium);
      if (!okBulk) {
        setComposerVisible(false);
        setEditingItem(null);
        return;
      }
      await timeAsync('homeInsertSmartAddItems', () =>
        insertItems.mutateAsync({
          userId,
          items: preCategorized.map((it) => ({
            user_id: userId,
            name: it.name,
            normalized_name: it.normalized_name,
            category: it.category,
            zone_key: it.zone_key,
            quantity_value: it.quantity,
            quantity_unit: it.unit,
            notes: null,
            is_checked: false,
            linked_meal_ids: [],
            brand_preference: null,
            substitute_allowed: true,
            priority: 'normal',
            is_recurring: false,
          })),
        })
      );
      try {
        await Promise.all(
          preCategorized.map((it) => recordItemAdded(it.normalized_name, it.name, it.unit))
        );
      } catch {
        // Recent-items cache is non-fatal
      }
      setComposerVisible(false);
      setEditingItem(null);
    },
    [insertItems, items, isPremium]
  );

  const handleDuplicateAlertClose = useCallback(() => {
    pendingDuplicateAfterComposerRef.current = null;
    setDuplicateResolution(null);
  }, []);

  const duplicateItemAlert = useMemo(() => {
    const r = duplicateResolution;
    if (!r) {
      return { message: undefined as string | undefined, buttons: [] as AppConfirmationButton[] };
    }
    const { match, incoming } = r;
    const { existing } = match;
    const existingUnit = (existing.quantity_unit ?? 'ea').toString();
    const incomingQty = incoming.quantity ?? 1;
    const incomingUnit = (incoming.unit ?? 'ea').toString();
    const existingQty = existing.quantity_value ?? 1;

    let message = `"${existing.name}" is already on your list.`;
    message += `\n\nCurrent: ${existingQty} ${existingUnit}\nAdding: ${incomingQty} ${incomingUnit}`;

    const buttons: AppConfirmationButton[] = [{ label: 'Dismiss', onPress: () => {} }];

    return { message, buttons };
  }, [duplicateResolution]);

  const handleComposerEdit = useCallback(
    async (id: string, parsed: ParsedItem, zoneKey: ZoneKey) => {
      if (typeof userId !== 'string' || !userId.length) return;
      const normalizedName = parsed.name.toLowerCase().trim().replace(/\s+/g, ' ');
      await updateItem.mutateAsync({
        userId,
        id,
        updates: {
          name: parsed.name,
          normalized_name: normalizedName,
          zone_key: zoneKey,
          quantity_value: parsed.quantity,
          quantity_unit: parsed.unit,
          notes: parsed.note ?? null,
          brand_preference: parsed.brand_preference ?? null,
          substitute_allowed: parsed.substitute_allowed ?? true,
          priority: parsed.priority ?? 'normal',
          is_recurring: parsed.is_recurring ?? false,
        },
      });
      void putCachedCategories([
        {
          normalized_name: normalizedName,
          zone_key: zoneKey,
          category:
            editingItem?.id === id && editingItem.category && editingItem.zone_key === zoneKey
              ? editingItem.category
              : ZONE_LABELS[zoneKey],
        },
      ]);
      setEditingItem(null);
      setComposerVisible(false);
    },
    [editingItem, updateItem, userId]
  );

  const handleToggle = useCallback(
    async (id: string, is_checked: boolean) => {
      if (typeof userId !== 'string' || !userId.length) return;
      if (isPendingListItemId(id)) return;
      const currentItems = itemsRef.current;
      const toggledItem = currentItems.find((i) => i.id === id);
      const zoneKey = toggledItem?.zone_key;

      if (shoppingMode === 'shop' && is_checked && zoneKey && toggledItem) {
        const zoneItems = currentItems.filter((i) => i.zone_key === zoneKey);
        const wouldBeComplete = zoneItems.every((i) =>
          i.id === id ? is_checked : toBoolean(i.is_checked)
        );
        if (wouldBeComplete) {
          setCollapsedZones((prev) => new Set(prev).add(zoneKey));
        }
      }

      try {
        await timeAsync('homeToggleItem', () =>
          toggleItem.mutateAsync({ userId, id, isChecked: is_checked })
        );
      } catch {
        // toggleItem's onError rolls back the optimistic cache update
      }
    },
    [shoppingMode, toggleItem, userId]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (typeof userId !== 'string' || !userId.length) return;
      if (isPendingListItemId(id)) return;
      try {
        await removeItem.mutateAsync({ userId, id });
      } catch {
        // removeItem rolls back + invalidates on error
      }
    },
    [removeItem, userId]
  );

  const requestDeleteListItem = useCallback((id: string) => {
    setListDeleteDialog({ kind: 'item', id });
  }, []);

  const requestDeleteZone = useCallback(
    (zoneKey: ZoneKey) => {
      haptics.light();
      setListDeleteDialog({ kind: 'zone', zoneKey });
    },
    [haptics]
  );

  const enterZoneClearMode = useCallback(
    (zoneKey: ZoneKey) => {
      haptics.selection();
      setZoneClearMode(zoneKey);
    },
    [haptics]
  );

  const exitZoneClearMode = useCallback(() => {
    setZoneClearMode(null);
  }, []);

  const openListActionsSheet = useCallback(() => {
    setZoneClearMode(null);
    setListActionsVisible(true);
  }, []);

  const handleDeleteEntireListFromMenu = useCallback(() => {
    pendingDeleteEntireListAfterSheetRef.current = true;
    setListActionsVisible(false);
  }, []);

  const handleListActionsSheetDismissed = useCallback(() => {
    if (!pendingDeleteEntireListAfterSheetRef.current) return;
    pendingDeleteEntireListAfterSheetRef.current = false;
    requestAnimationFrame(() => {
      setListDeleteDialog({ kind: 'all' });
    });
  }, []);

  const handleListDeleteDialogClose = useCallback(() => {
    setListDeleteDialog(null);
  }, []);

  const handleDeleteAll = useCallback(async () => {
    const uid = userId;
    if (typeof uid !== 'string' || !uid.length) return;
    setCollapsedZones(new Set());
    setFilterZone('all');
    try {
      await removeAllItems.mutateAsync({ userId: uid });
    } catch {
      /* removeAllItems rolls back + invalidates on error */
    }
    setComposerVisible(false);
    setEditingItem(null);
  }, [userId, removeAllItems]);

  const handleDeleteZone = useCallback(
    async (zoneKey: ZoneKey) => {
      const uid = userId;
      if (typeof uid !== 'string' || !uid.length) return;
      try {
        await removeZoneItems.mutateAsync({ userId: uid, zoneKey });
      } catch {
        /* removeZoneItems rolls back + invalidates on error */
      }
      if (editingItem?.zone_key === zoneKey) {
        setEditingItem(null);
        setComposerVisible(false);
      }
    },
    [userId, removeZoneItems, editingItem]
  );

  const handleListDeleteConfirm = useCallback(() => {
    const d = listDeleteDialog;
    setListDeleteDialog(null);
    if (!d) return;
    if (d.kind === 'item') {
      if (isPendingListItemId(d.id)) return;
      void handleDelete(d.id);
      if (editingItem?.id === d.id) {
        setEditingItem(null);
        setComposerVisible(false);
      }
    } else if (d.kind === 'all') {
      void handleDeleteAll();
    } else if (d.kind === 'zone') {
      setZoneClearMode(null);
      void handleDeleteZone(d.zoneKey);
    }
  }, [listDeleteDialog, handleDelete, editingItem, handleDeleteAll, handleDeleteZone]);

  const toggleZone = useCallback((zone: ZoneKey) => {
    setCollapsedZones((prev) => {
      const next = new Set(prev);
      if (next.has(zone)) next.delete(zone);
      else next.add(zone);
      return next;
    });
  }, []);

  const handleModeChange = useCallback(
    (mode: 'plan' | 'shop') => {
      setZoneClearMode(null);
      setFilterZone('all');
      setShoppingMode(mode);
      const currentItems = itemsRef.current;
      if (mode === 'shop' && currentItems.length > 0) {
        const completedZones = (zoneOrder ?? DEFAULT_ZONE_ORDER).filter((zone) => {
          const zoneItems = currentItems.filter((i) => i.zone_key === zone);
          return zoneItems.length > 0 && zoneItems.every((i) => toBoolean(i.is_checked));
        });
        if (completedZones.length > 0) {
          setCollapsedZones((prev) => {
            const next = new Set(prev);
            completedZones.forEach((z) => next.add(z));
            return next;
          });
        }
      }
    },
    [zoneOrder, setShoppingMode]
  );

  const safeZoneOrder = useMemo(() => safeZoneOrderOrDefault(zoneOrder), [zoneOrder]);
  const effectiveZoneOrder = useMemo(
    () => sessionZoneOrder ?? safeZoneOrder,
    [sessionZoneOrder, safeZoneOrder]
  );
  const smartAddStoreType = store?.store_type ?? 'generic';
  const smartAddZoneLabels = useMemo(
    () => effectiveZoneOrder.map((k) => ZONE_LABELS[k]),
    [effectiveZoneOrder]
  );
  const zoneIconOverrides = DEFAULT_ZONE_ICON_OVERRIDES;

  const derived = useMemo(
    () => {
      const next = time('deriveHomeListModel', () =>
        deriveHomeListModel(items, effectiveZoneOrder, shoppingMode, filterZone)
      );
      const shared = shareHomeListDerivedModel(previousDerivedRef.current, next);
      previousDerivedRef.current = shared;
      return shared;
    },
    [items, effectiveZoneOrder, shoppingMode, filterZone]
  );
  const {
    zoneCounts,
    remaining,
    zoneRemaining,
    sectionsLeft,
    currentSection,
    nextSectionForSummary,
    isFiltered,
    filteredItems,
    filteredRemaining,
    filteredZoneCount,
    filteredSectionsLeft,
    orderedSections,
    sections,
  } = derived;

  sectionsRef.current = sections;

  useEffect(() => {
    notifyListItemsForMilestones(items);
  }, [items]);

  const handleQuickAddSheetDismissed = useCallback(() => {
    const pending = pendingDuplicateAfterComposerRef.current;
    if (!pending) return;
    pendingDuplicateAfterComposerRef.current = null;
    requestAnimationFrame(() => {
      setDuplicateResolution(pending);
    });
  }, []);

  const handleBottomQuickAddSubmit = useCallback(
    async (
      parsedItems: ParsedItem[],
      zoneOverride: ZoneKey | null,
      barOpts?: ComposerSubmitOptions
    ) => {
      try {
        await handleComposerSubmit(parsedItems, zoneOverride, barOpts);
      } catch (e) {
        if ((e as { code?: string })?.code === 'DUPLICATE') {
          const pending = pendingDuplicateAfterComposerRef.current;
          if (pending) {
            pendingDuplicateAfterComposerRef.current = null;
            setDuplicateResolution(pending);
          }
        }
        throw e;
      }
    },
    [handleComposerSubmit]
  );

  const onViewableItemsChanged = useRef(() => {}).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 28,
    minimumViewTime: 150,
  }).current;

  // Memoize derived layout values: they feed props to memoized children (FAB, zone list)
  // and were previously recomputed on every parent render, forcing children to diff them.
  const bottomBarBottom = useMemo(
    () => tabBarHeight + Math.max(insets.bottom, theme.spacing.sm) + theme.spacing.sm,
    [tabBarHeight, insets.bottom, theme.spacing.sm]
  );
  const listContentBottomPad = useMemo(
    () =>
      bottomBarBottom +
      bottomQuickAddClearance(ITEM_NAME_SUGGESTION_UI_CAP) +
      theme.spacing.sm,
    [bottomBarBottom, theme.spacing.sm]
  );
  const listScrollTopInset = scrollTopBelowTabHeader;

  /**
   * FlatList's `extraData` forces row re-render when anything listed here flips.
   * Memoize so we don't allocate a new array spread + sort + join on every parent
   * render (which includes every scroll-driven state change like contextual FAB).
   */
  const collapsedZonesSignature = useMemo(
    () => [...collapsedZones].sort().join(','),
    [collapsedZones]
  );
  const reorderSectionsSignature = useMemo(
    () => reorderSections.map((s) => s.zone).join(','),
    [reorderSections]
  );
  const zoneListExtraData = useMemo(
    () =>
      `${filterZone}-${shoppingMode}-${collapsedZonesSignature}-${zoneClearMode ?? ''}-${reorderMode}-${reorderSectionsSignature}`,
    [
      filterZone,
      shoppingMode,
      collapsedZonesSignature,
      zoneClearMode,
      reorderMode,
      reorderSectionsSignature,
    ]
  );

  useEffect(() => {
    if (listBlocking || !shoppingModeHydrated) return;
    if (shoppingMode !== 'shop') {
      shopRunCompleteGateRef.current = false;
      setShopRunCompleteVisible(false);
      setShopRunCompleteStats(null);
      return;
    }
    if (items.length === 0) {
      shopRunCompleteGateRef.current = false;
      setShopRunCompleteVisible(false);
      setShopRunCompleteStats(null);
      return;
    }
    if (remaining > 0) {
      shopRunCompleteGateRef.current = false;
      setShopRunCompleteVisible(false);
      setShopRunCompleteStats(null);
      return;
    }
    if (!shopRunCompleteGateRef.current) {
      shopRunCompleteGateRef.current = true;
      const aisleCount = new Set(items.map((i) => i.zone_key)).size;
      setShopRunCompleteStats({ totalItems: items.length, aisleCount });
      setShopRunCompleteVisible(true);
      haptics.success();
    }
  }, [
    listBlocking,
    shoppingModeHydrated,
    shoppingMode,
    items,
    items.length,
    remaining,
    haptics,
  ]);

  const dismissShopRunComplete = useCallback(() => {
    setShopRunCompleteVisible(false);
    setShopRunCompleteStats(null);
    setCollapsedZones(new Set());
    maybePromptForReview('shop_run_complete');
  }, [maybePromptForReview]);

  const handleRemoveCheckedFromCelebration = useCallback(async () => {
    const uid = userId;
    if (typeof uid !== 'string' || !uid.length) return;
    try {
      await removeCheckedItems.mutateAsync({ userId: uid });
      haptics.light();
    } catch {
      /* removeCheckedItems rolls back on error */
    } finally {
      setShopRunCompleteVisible(false);
      setShopRunCompleteStats(null);
      setCollapsedZones(new Set());
      maybePromptForReview('shop_run_complete');
    }
  }, [userId, removeCheckedItems, haptics, maybePromptForReview]);

  const collapseAll = useCallback(() => {
    const zonesToCollapse = sections.map((s) => s.zone);
    setCollapsedZones((prev) => {
      const next = new Set(prev);
      zonesToCollapse.forEach((z) => next.add(z));
      return next;
    });
  }, [sections]);

  const expandAll = useCallback(() => {
    setCollapsedZones(new Set());
  }, []);

  const enterReorderMode = useCallback(() => {
    setZoneClearMode(null);
    setFilterZone('all');
    collapsedSnapshotRef.current = new Set(collapsedZones);
    setCollapsedZones(new Set(orderedSections.map((s) => s.zone)));
    setReorderSections([...orderedSections]);
    setReorderMode(true);
  }, [orderedSections, collapsedZones]);

  const exitReorderMode = useCallback(() => {
    const snap = collapsedSnapshotRef.current;
    collapsedSnapshotRef.current = null;
    if (snap) setCollapsedZones(snap);
    setReorderMode(false);
  }, []);

  const handleReorderDone = useCallback(() => {
    const snap = collapsedSnapshotRef.current;
    collapsedSnapshotRef.current = null;
    if (snap) setCollapsedZones(snap);
    setReorderMode(false);
    const newOrder = reorderSections.map((s) => s.zone);
    setReorderSaveOrder(newOrder);
    setReorderSaveSheetVisible(true);
  }, [reorderSections]);

  const closeReorderSaveSheet = useCallback(() => {
    setReorderSaveSheetVisible(false);
    setReorderSaveOrder(null);
  }, []);

  if (listBlocking || !shoppingModeHydrated) {
    return (
      <Screen padded={false} safeTop={false} safeBottom={false}>
        <View style={[styles.centered, { backgroundColor: theme.background }]}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} safeTop={false} safeBottom={false}>
      <View style={styles.homeRoot}>
        <View style={styles.headerOverlay} pointerEvents="box-none">
          <ListScreenHeader
            shoppingMode={shoppingMode}
            onShoppingModeChange={handleModeChange}
            reorderMode={reorderMode}
          />
        </View>
        {items.length === 0 ? (
          <HomeScreenEmptyState scrollContentPaddingTop={scrollTopBelowTabHeader} />
        ) : (
          <View style={[styles.container, { backgroundColor: theme.background }]}>
            <HomeScreenZoneList
              themeAccent={theme.accent}
              themeOnAccent={theme.onAccent}
              sections={sections}
              extraData={zoneListExtraData}
              scrollContentInsetTop={listScrollTopInset}
              listContentBottomPad={listContentBottomPad}
              listScrollHandler={listScrollHandler}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              collapsedZones={collapsedZones}
              filterZone={filterZone}
              shoppingMode={shoppingMode}
              safeItems={items}
              zoneCounts={zoneCounts}
              zoneRemaining={zoneRemaining}
              isFiltered={isFiltered}
              filteredItems={filteredItems}
              filteredZoneCount={filteredZoneCount}
              filteredRemaining={filteredRemaining}
              filteredSectionsLeft={filteredSectionsLeft}
              remaining={remaining}
              sectionsLeft={sectionsLeft}
              nextSectionForSummary={nextSectionForSummary}
              currentSection={currentSection}
              refreshing={refreshing}
              onRefresh={onRefresh}
              setFilterZone={setFilterZone}
              openListActionsSheet={openListActionsSheet}
              zoneClearMode={zoneClearMode}
              onEnterZoneClearMode={enterZoneClearMode}
              onExitZoneClearMode={exitZoneClearMode}
              toggleZone={toggleZone}
              handleToggle={handleToggle}
              requestDeleteListItem={requestDeleteListItem}
              requestDeleteZone={requestDeleteZone}
              openComposerForEdit={openComposerForEdit}
              reduceMotion={reduceMotion}
              linkedMealLabels={linkedMealLabels}
              zoneIconOverrides={zoneIconOverrides}
              reorderMode={reorderMode}
              reorderSections={reorderSections}
              setReorderSections={setReorderSections}
              onReorderCancel={() => {
                haptics.light();
                exitReorderMode();
              }}
              onReorderDone={() => {
                haptics.light();
                handleReorderDone();
              }}
              reorderHaptics={haptics}
              lastPlaceholderIndexRef={lastPlaceholderIndexRef}
              listScrollShared={listScrollShared}
            />
          </View>
        )}
      </View>
      {!reorderMode ? (
        <BottomQuickAddBar
          ref={bottomAddBarRef}
          onSubmit={handleBottomQuickAddSubmit}
          disabled={listBlocking || !shoppingModeHydrated}
          listItemNames={listItemNames}
          storeType={smartAddStoreType}
          zoneLabelsInOrder={smartAddZoneLabels}
        />
      ) : null}
      {composerMounted ? (
        <QuickAddComposer
          ref={composerRef}
          visible={composerVisible}
          onDismiss={() => {
            setComposerVisible(false);
            setEditingItem(null);
          }}
          onSheetDismissed={handleQuickAddSheetDismissed}
          onSubmit={handleComposerSubmit}
          editingItem={editingItem}
          onEdit={handleComposerEdit}
          zoneOrderForPicker={effectiveZoneOrder}
          onBulkAddPreCategorized={handleBulkAddPreCategorized}
          storeType={smartAddStoreType}
          zoneLabelsInOrder={smartAddZoneLabels}
        />
      ) : null}
      {listActionsMounted ? (
        <ListActionsSheet
          visible={listActionsVisible}
          onClose={() => setListActionsVisible(false)}
          onDismissed={handleListActionsSheetDismissed}
          onCollapseAll={collapseAll}
          onExpandAll={expandAll}
          onReorderSections={enterReorderMode}
          onDeleteEntireList={handleDeleteEntireListFromMenu}
        />
      ) : null}
      {reorderSaveSheetMounted ? (
        <AppActionSheet
          visible={reorderSaveSheetVisible}
          onClose={closeReorderSaveSheet}
          title="Save section order"
          message="How would you like to save this order?"
          actions={[
            {
              label: 'For this trip only',
              onPress: () => setSessionZoneOrder(reorderSaveOrder ?? []),
            },
            {
              label: 'As my default',
              onPress: async () => {
                if (!reorderSaveOrder) return;
                setZoneOrder(reorderSaveOrder);
                setSessionZoneOrder(null);
                await patchUserPreferencesIfSync({
                  listUi: { zoneOrder: reorderSaveOrder },
                });
              },
            },
            {
              label: 'Revert',
              onPress: () => setSessionZoneOrder(null),
            },
          ]}
        />
      ) : null}
      {listDeleteDialogMounted ? (
        <AppConfirmationDialog
          visible={listDeleteDialog != null}
          onClose={handleListDeleteDialogClose}
          title={
            listDeleteDialog?.kind === 'item'
              ? 'Remove item'
              : listDeleteDialog?.kind === 'all'
                ? 'Delete entire list?'
                : listDeleteDialog?.kind === 'zone'
                  ? 'Delete this section?'
                  : ''
          }
          message={
            listDeleteDialog?.kind === 'item'
              ? 'Remove this item from your list?'
              : listDeleteDialog?.kind === 'all'
                ? 'Every item will be removed from your list. This cannot be undone.'
                : listDeleteDialog?.kind === 'zone'
                  ? `All items in ${ZONE_LABELS[listDeleteDialog.zoneKey]} will be removed. This cannot be undone.`
                  : undefined
          }
          buttons={[
            { label: 'Cancel', onPress: () => {}, cancel: true },
            { label: 'Delete', onPress: handleListDeleteConfirm, destructive: true },
          ]}
        />
      ) : null}
      {duplicateResolutionMounted ? (
        <AppConfirmationDialog
          visible={duplicateResolution != null}
          onClose={handleDuplicateAlertClose}
          title="Already on your list"
          message={duplicateItemAlert.message}
          buttons={duplicateItemAlert.buttons}
          allowBackdropDismiss
          contentAlignment="center"
        />
      ) : null}
      <ShopRunCompleteOverlay
        visible={shopRunCompleteVisible && shopRunCompleteStats != null}
        totalItems={shopRunCompleteStats?.totalItems ?? 0}
        aisleCount={shopRunCompleteStats?.aisleCount ?? 0}
        onKeep={dismissShopRunComplete}
        onClearChecked={handleRemoveCheckedFromCelebration}
        clearing={removeCheckedItems.isPending}
        reduceMotion={reduceMotion}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  /** `position` so any absolute overlays (e.g. FAB-adjacent UI) anchor to this screen. */
  homeRoot: { flex: 1, position: 'relative' },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
