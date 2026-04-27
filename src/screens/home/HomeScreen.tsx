import React, { useState, useCallback, useRef, useLayoutEffect, useEffect, useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator, type ViewToken } from 'react-native';
import { useAnimatedReaction, useSharedValue, runOnJS } from 'react-native-reanimated';
import { useQuery, useQueryClient, useIsRestoring } from '@tanstack/react-query';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useNavigationChromeScroll } from '../../navigation/NavigationChromeScrollContext';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../design/ThemeContext';
import { tabScrollPaddingTopBelowHeader } from '../../design/layout';
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
import { fetchUserPreferences, patchUserPreferencesIfSync } from '../../services/userPreferencesService';
import { QuickAddComposer } from '../../components/list/QuickAddComposer';
import type { QuickAddComposerHandle } from '../../components/list/QuickAddComposer';
import type { ListItem, ZoneKey, StoreProfile } from '../../types/models';
import { FloatingAddButton } from '../../components/ui/FloatingAddButton';
import { normalize, toBoolean } from '../../utils/normalize';
import { getCachedCategorySync } from '../../services/aiCategoryCache';
import { logger } from '../../utils/logger';
import type { ParsedItem } from '../../utils/parseItems';
import { findDuplicate, type DuplicateMatch } from '../../utils/duplicateDetection';
import type { ParsedListItem } from '../../types/api';
import { normalizePersistedZoneOrder } from '../../utils/zoneOrderPrefs';
import { showError } from '../../utils/appToast';
import { ListActionsSheet } from '../../components/list/ListActionsSheet';
import { AppActionSheet } from '../../components/ui/AppActionSheet';
import { ListScreenHeader } from '../../components/list/ListScreenHeader';
import { recordItemAdded } from '../../services/recentItemsStore';
import { useReduceMotion } from '../../ui/motion/useReduceMotion';
import { FAB_CLEARANCE, useFabExpandScrollHandler } from '../../hooks/useFabExpandScrollHandler';
import { useHomeListMutations } from '../../hooks/useHomeListMutations';
import { useLazyMount } from '../../hooks/useLazyMount';
import { queryKeys } from '../../query/keys';
import { fetchHomeListBundle, HOME_LIST_STALE_MS } from '../../query/homeListBundle';
import { prefetchRecipesAndDefaultMealsRange } from '../../query/prefetchAdjacentTabs';
import {
  deriveHomeListModel,
  safeZoneOrderOrDefault,
  type HomeSectionItem,
} from './homeScreenListDerived';
import { HomeScreenEmptyState } from './HomeScreenEmptyState';
import { HomeScreenZoneList } from './HomeScreenZoneList';
import { QueryUpdatingBar } from '../../components/ui/QueryUpdatingBar';
import { markRender, time } from '../../utils/perf';

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

export function HomeScreen() {
  if (__DEV__) markRender('HomeScreen');
  const theme = useTheme();
  const queryClient = useQueryClient();
  const headerHeight = useHeaderHeight();
  const scrollTopBelowTabHeader = tabScrollPaddingTopBelowHeader(headerHeight, theme.spacing);
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const haptics = useHaptics();
  const navigation = useNavigation();
  const reduceMotion = useReduceMotion();
  const composerRef = useRef<QuickAddComposerHandle>(null);
  const sectionsRef = useRef<HomeSectionItem[]>([]);
  const { scrollY: tabScrollY } = useNavigationChromeScroll();
  const listScrollShared = tabScrollY.ListTab;
  const { fabExpandProgress, listScrollHandler } = useFabExpandScrollHandler(listScrollShared);
  const contextualFabScrollPrev = useSharedValue(false);
  const [fabScrollPastContextThreshold, setFabScrollPastContextThreshold] = useState(false);
  /** Current topmost visible zone, updated on every viewability change. */
  const visibleZoneRef = useRef<ZoneKey | null>(null);
  /** Whether the FAB is currently showing (or would show) a contextual label;
   *  `onViewableItemsChanged` only mirrors zone changes to JS state when this is on. */
  const contextualGateRef = useRef(false);
  /** Last zone we mirrored into `visibleZoneKey` state; avoids redundant setState calls. */
  const lastMirroredZoneRef = useRef<ZoneKey | null>(null);
  const [visibleZoneKey, setVisibleZoneKey] = useState<ZoneKey | null>(null);
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
  } = useHomeListMutations();

  /** Scroll offset above this shows contextual “Add to [section]” on the FAB (crossing only, no per-frame JS). */
  const FAB_CONTEXT_SCROLL_PX = 72;

  useAnimatedReaction(
    () => listScrollShared.value,
    (y) => {
      const crossed = y > FAB_CONTEXT_SCROLL_PX;
      if (crossed !== contextualFabScrollPrev.value) {
        contextualFabScrollPrev.value = crossed;
        runOnJS(setFabScrollPastContextThreshold)(crossed);
      }
    },
    [listScrollShared]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = await fetchUserPreferences();
      if (cancelled) return;
      const lz = p.listUi;
      if (lz?.filterZone === 'all' || (lz?.filterZone && VALID_LIST_ZONES.has(lz.filterZone as ZoneKey))) {
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

  const openComposerForEdit = useCallback((item: ListItem) => {
    haptics.light();
    setZoneClearMode(null);
    setEditingItem(item);
    setComposerVisible(true);
  }, [haptics]);

  const handleComposerSubmit = useCallback(
    async (parsedItems: ParsedItem[], zoneOverride: ZoneKey | null) => {
      const userId = await getUserId();
      if (!userId) throw new Error('Not signed in');
      const storeType = store?.store_type ?? 'generic';
      const zoneLabelsInOrder = (sessionZoneOrder ?? safeZoneOrderOrDefault(zoneOrder)).map(
        (k) => ZONE_LABELS[k]
      );

      // Single-item fast path: consult the local categorization cache and insert
      // optimistically. A cache hit skips the network entirely; a miss inserts
      // under zone 'other' immediately and patches the row in the background
      // once categorize-items resolves. Saves the full ~300–700ms AI round-trip
      // from the composer's perceived latency.
      if (parsedItems.length === 1) {
        const p = parsedItems[0];
        const cached = getCachedCategorySync(p.name);
        const normalizedName = cached?.normalized_name ?? (normalize(p.name) || p.name);
        const resolvedZone: ZoneKey = zoneOverride ?? (cached?.zone_key ?? 'other');
        const resolvedCategory = cached?.category ?? 'uncategorized';

        const match = findDuplicate(items, p);
        if (match) {
          haptics.light();
          pendingDuplicateAfterComposerRef.current = {
            match,
            incoming: p,
            categorized: {
              normalized_name: normalizedName,
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

        const inserted = await insertItems.mutateAsync({
          userId,
          items: [
            {
              user_id: userId,
              name: normalizedName,
              normalized_name: normalizedName,
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
            },
          ],
        });

        try {
          await recordItemAdded(normalizedName, p.name ?? normalizedName, p.unit);
        } catch {
          // Recent-items cache is non-fatal
        }
        setComposerVisible(false);
        setEditingItem(null);

        // Only run the background categorize when we genuinely don't know the zone.
        // If the user tapped a contextual "Add to [section]" FAB (zoneOverride != null)
        // we respect their pick — no AI call, no surprise re-home. On cache hit the
        // zone is already correct so we also skip.
        const insertedId = inserted?.[0]?.id;
        if (!cached && zoneOverride == null && insertedId) {
          void (async () => {
            try {
              const { categorizeItems } = await import('../../services/aiService');
              const res = await categorizeItems([p.name], storeType, zoneLabelsInOrder);
              const r = res.results[0];
              if (!r) return;
              // No-op if the server returned the same 'other' bucket we already
              // optimistically assigned — avoids an extra cache invalidation.
              if (
                r.zone_key === 'other' &&
                r.category === resolvedCategory &&
                r.normalized_name === normalizedName
              ) {
                return;
              }
              await updateItem.mutateAsync({
                userId,
                id: insertedId,
                updates: {
                  normalized_name: r.normalized_name,
                  category: r.category,
                  zone_key: r.zone_key as ZoneKey,
                },
              });
            } catch (e) {
              // Row is already visible under 'Other'; user can re-categorize manually.
              if (__DEV__) logger.warn('background categorize failed', e);
            }
          })();
        }
        return;
      }

      // Multi-item path: keep today's synchronous categorize → bulk insert flow.
      // Users who paste a multi-line list expect all rows to land pre-sorted; the
      // brief AI wait here is tolerable and matches the Smart Add review flow.
      const rawNames = parsedItems.map((p) => p.name);
      let results: { normalized_name: string; category: string; zone_key: string }[];
      try {
        const { categorizeItems } = await import('../../services/aiService');
        const res = await categorizeItems(rawNames, storeType, zoneLabelsInOrder);
        results = res.results;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        showError(
          msg.length > 140 ? `${msg.slice(0, 140)}…` : msg,
          'Could not auto-categorize'
        );
        results = rawNames.map((name) => ({
          normalized_name: normalize(name) || name,
          category: 'other',
          zone_key: 'other',
        }));
      }

      if (zoneOverride !== null) {
        results = results.map((r) => ({
          ...r,
          zone_key: zoneOverride,
        }));
      }

      await insertItems.mutateAsync({
        userId,
        items: results.map((r, i) => {
          const p = parsedItems[i];
          return {
            user_id: userId,
            name: r.normalized_name,
            normalized_name: r.normalized_name,
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
      });
      try {
        await Promise.all(
          parsedItems.map((_, i) =>
            recordItemAdded(
              results[i].normalized_name,
              parsedItems[i]?.name ?? results[i].normalized_name,
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
    [insertItems, updateItem, items, zoneOrder, sessionZoneOrder, store, haptics]
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
      await insertItems.mutateAsync({
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
      });
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
    [insertItems]
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

    const buttons: AppConfirmationButton[] = [
      { label: 'Dismiss', onPress: () => {} },
    ];

    return { message, buttons };
  }, [duplicateResolution]);

  const handleComposerEdit = useCallback(
    async (id: string, parsed: ParsedItem, zoneKey: ZoneKey) => {
      if (typeof userId !== 'string' || !userId.length) return;
      await updateItem.mutateAsync({
        userId,
        id,
        updates: {
          name: parsed.name,
          normalized_name: parsed.name.toLowerCase().trim().replace(/\s+/g, ' '),
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
      setEditingItem(null);
      setComposerVisible(false);
    },
    [updateItem, userId]
  );

  const handleToggle = useCallback(
    async (id: string, is_checked: boolean) => {
      if (typeof userId !== 'string' || !userId.length) return;
      const toggledItem = items.find((i) => i.id === id);
      const zoneKey = toggledItem?.zone_key;

      if (
        shoppingMode === 'shop' &&
        is_checked &&
        zoneKey &&
        toggledItem
      ) {
        const zoneItems = items.filter((i) => i.zone_key === zoneKey);
        const wouldBeComplete = zoneItems.every((i) =>
          i.id === id ? is_checked : toBoolean(i.is_checked)
        );
        if (wouldBeComplete) {
          setCollapsedZones((prev) => new Set(prev).add(zoneKey));
        }
      }

      try {
        await toggleItem.mutateAsync({ userId, id, isChecked: is_checked });
      } catch {
        // toggleItem's onError rolls back the optimistic cache update
      }
    },
    [items, shoppingMode, toggleItem, userId]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (typeof userId !== 'string' || !userId.length) return;
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

  const enterZoneClearMode = useCallback((zoneKey: ZoneKey) => {
    haptics.selection();
    setZoneClearMode(zoneKey);
  }, [haptics]);

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
      if (mode === 'shop' && items.length > 0) {
        const completedZones = (
          zoneOrder ?? DEFAULT_ZONE_ORDER
        ).filter((zone) => {
          const zoneItems = items.filter((i) => i.zone_key === zone);
          return (
            zoneItems.length > 0 &&
            zoneItems.every((i) => toBoolean(i.is_checked))
          );
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
    [items, zoneOrder, setShoppingMode]
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
    () =>
      time('deriveHomeListModel', () =>
        deriveHomeListModel(items, effectiveZoneOrder, shoppingMode, filterZone)
      ),
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

  const openComposer = useCallback(() => {
    setZoneClearMode(null);
    setEditingItem(null);
    setComposerVisible(true);
  }, []);

  const handleQuickAddSheetDismissed = useCallback(() => {
    const pending = pendingDuplicateAfterComposerRef.current;
    if (!pending) return;
    pendingDuplicateAfterComposerRef.current = null;
    requestAnimationFrame(() => {
      setDuplicateResolution(pending);
    });
  }, []);

  /** Keep the gate ref in sync; when turning off, clear the mirrored state so
   *  the FAB drops its contextual label. When turning on (or filterZone
   *  changes while on), push the latest-known zone into state once. */
  useEffect(() => {
    const on = fabScrollPastContextThreshold && filterZone === 'all';
    contextualGateRef.current = on;
    if (!on) {
      if (lastMirroredZoneRef.current !== null) {
        lastMirroredZoneRef.current = null;
        setVisibleZoneKey(null);
      }
      return;
    }
    const z = visibleZoneRef.current;
    if (z && lastMirroredZoneRef.current !== z) {
      lastMirroredZoneRef.current = z;
      setVisibleZoneKey(z);
    }
  }, [fabScrollPastContextThreshold, filterZone]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (!first?.item || typeof first.item !== 'object' || !('zone' in first.item)) return;
      const z = (first.item as HomeSectionItem).zone;
      visibleZoneRef.current = z;
      if (contextualGateRef.current && lastMirroredZoneRef.current !== z) {
        lastMirroredZoneRef.current = z;
        setVisibleZoneKey(z);
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 28,
    minimumViewTime: 150,
  }).current;

  // Memoize derived layout values: they feed props to memoized children (FAB, zone list)
  // and were previously recomputed on every parent render, forcing children to diff them.
  const fabBottom = useMemo(
    () => tabBarHeight + Math.max(insets.bottom, theme.spacing.sm) + theme.spacing.sm,
    [tabBarHeight, insets.bottom, theme.spacing.sm]
  );
  const listContentBottomPad = useMemo(
    () => fabBottom + FAB_CLEARANCE + theme.spacing.sm,
    [fabBottom, theme.spacing.sm]
  );
  const listScrollTopInset = scrollTopBelowTabHeader;
  const fabContextualLabel = useMemo(
    () =>
      fabScrollPastContextThreshold && filterZone === 'all' && visibleZoneKey
        ? ZONE_LABELS[visibleZoneKey]
        : null,
    [fabScrollPastContextThreshold, filterZone, visibleZoneKey]
  );

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
    [filterZone, shoppingMode, collapsedZonesSignature, zoneClearMode, reorderMode, reorderSectionsSignature]
  );

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

  useLayoutEffect(() => {
    navigation.setOptions({
      header: () => (
        <ListScreenHeader
          shoppingMode={shoppingMode}
          onShoppingModeChange={handleModeChange}
          reorderMode={reorderMode}
        />
      ),
    });
  }, [navigation, shoppingMode, handleModeChange, reorderMode]);

  const closeReorderSaveSheet = useCallback(() => {
    setReorderSaveSheetVisible(false);
    setReorderSaveOrder(null);
  }, []);

  const userReady = typeof userId === 'string' && userId.length > 0;
  /** Full-screen gate only when there is no cached bundle yet (persisted or in-memory). */
  const listAwaitingFirstPayload =
    userReady &&
    listQuery.data === undefined &&
    (listQuery.isPending || isRestoringCache);
  const listBlocking = userId === undefined || listAwaitingFirstPayload;

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
        {items.length === 0 ? (
          <HomeScreenEmptyState
            scrollContentPaddingTop={scrollTopBelowTabHeader}
            onPressAdd={() => {
              haptics.light();
              setEditingItem(null);
              setComposerVisible(true);
            }}
          />
        ) : (
          <View style={[styles.container, { backgroundColor: theme.background }]}>
        <QueryUpdatingBar
          visible={
            userReady &&
            !!listQuery.data &&
            listQuery.isFetching &&
            !refreshing
          }
        />
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
        {!composerVisible && !reorderMode && (
          <FloatingAddButton
            onPress={openComposer}
            expandProgress={fabExpandProgress}
            bottom={fabBottom}
            contextualZoneLabel={fabContextualLabel}
          />
        )}
        </View>
        )}
      </View>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  /** `position` so any absolute overlays (e.g. FAB-adjacent UI) anchor to this screen. */
  homeRoot: { flex: 1, position: 'relative' },
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
