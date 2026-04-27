import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Pressable,
  RefreshControl,
  FlatList,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type FlatListProps,
  type ViewabilityConfig,
} from 'react-native';
import { createAnimatedComponent } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { useTheme } from '../../design/ThemeContext';
import { ListStatsHeader } from '../../components/list/ListStatsHeader';
import { ListSummaryStrip } from '../../components/list/ListSummaryStrip';
import { ZoneSection } from '../../components/list/ZoneSection';
import { ReorderSectionRow } from '../../components/list/ReorderSectionRow';
import { EmptyState } from '../../components/ui/EmptyState';
import { ZONE_LABELS } from '../../data/zone';
import type { ListItem, ZoneKey } from '../../types/models';
import type { ZoneIconOverrides } from '../../utils/storeUtils';
import type { HomeSectionItem } from './homeScreenListDerived';
import type { LinkedMealRowMeta } from '../../utils/mealLabel';
import { markRender } from '../../utils/perf';

const AnimatedFlatList = createAnimatedComponent(FlatList<HomeSectionItem>);

type OnViewableItemsChanged = NonNullable<
  FlatListProps<HomeSectionItem>['onViewableItemsChanged']
>;

/** Main list uses scrollEventThrottle={16}; shared scroll + FAB/chrome use Reanimated worklets that stay smooth at 60fps. */

type Props = {
  themeAccent: string;
  themeOnAccent: string;
  sections: HomeSectionItem[];
  extraData: string;
  scrollContentInsetTop: number;
  listContentBottomPad: number;
  listScrollHandler: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onViewableItemsChanged: OnViewableItemsChanged;
  viewabilityConfig: ViewabilityConfig;
  collapsedZones: Set<ZoneKey>;
  filterZone: ZoneKey | 'all';
  shoppingMode: 'plan' | 'shop';
  safeItems: ListItem[];
  zoneCounts: Record<ZoneKey, number>;
  zoneRemaining: Record<ZoneKey, number>;
  isFiltered: boolean;
  filteredItems: ListItem[];
  filteredZoneCount: number;
  filteredRemaining: number;
  filteredSectionsLeft: number;
  remaining: number;
  sectionsLeft: number;
  nextSectionForSummary: ZoneKey | null;
  currentSection: ZoneKey | null;
  refreshing: boolean;
  onRefresh: () => void;
  setFilterZone: React.Dispatch<React.SetStateAction<ZoneKey | 'all'>>;
  openListActionsSheet: () => void;
  zoneClearMode: ZoneKey | null;
  onEnterZoneClearMode: (zoneKey: ZoneKey) => void;
  onExitZoneClearMode: () => void;
  toggleZone: (zone: ZoneKey) => void;
  handleToggle: (id: string, checked: boolean) => void;
  requestDeleteListItem: (id: string) => void;
  requestDeleteZone: (zoneKey: ZoneKey) => void;
  openComposerForEdit: (item: ListItem) => void;
  reduceMotion: boolean;
  linkedMealLabels: Map<string, LinkedMealRowMeta>;
  zoneIconOverrides: ZoneIconOverrides;
  /** Inline section reorder: same screen, collapsed rows, drag to reorder. */
  reorderMode: boolean;
  reorderSections: HomeSectionItem[];
  setReorderSections: React.Dispatch<React.SetStateAction<HomeSectionItem[]>>;
  onReorderCancel: () => void;
  onReorderDone: () => void;
  reorderHaptics: { light: () => void; selection: () => void };
  lastPlaceholderIndexRef: React.MutableRefObject<number | null>;
  listScrollShared: SharedValue<number>;
};

export function HomeScreenZoneList({
  themeAccent,
  themeOnAccent,
  sections,
  extraData,
  scrollContentInsetTop,
  listContentBottomPad,
  listScrollHandler,
  onViewableItemsChanged,
  viewabilityConfig,
  collapsedZones,
  filterZone,
  shoppingMode,
  safeItems,
  zoneCounts,
  zoneRemaining,
  isFiltered,
  filteredItems,
  filteredZoneCount,
  filteredRemaining,
  filteredSectionsLeft,
  remaining,
  sectionsLeft,
  nextSectionForSummary,
  currentSection,
  refreshing,
  onRefresh,
  setFilterZone,
  openListActionsSheet,
  zoneClearMode,
  onEnterZoneClearMode,
  onExitZoneClearMode,
  toggleZone,
  handleToggle,
  requestDeleteListItem,
  requestDeleteZone,
  openComposerForEdit,
  reduceMotion,
  linkedMealLabels,
  zoneIconOverrides,
  reorderMode,
  reorderSections,
  setReorderSections,
  onReorderCancel,
  onReorderDone,
  reorderHaptics,
  lastPlaceholderIndexRef,
  listScrollShared,
}: Props) {
  const theme = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        list: { flex: 1 },
        listHeader: {
          paddingTop: theme.spacing.xs,
          paddingBottom: 0,
        },
        headerInteractiveBlock: {
          opacity: 1,
        },
        headerDimmed: {
          opacity: 0.48,
        },
        zoneClearDismissFooter: {
          flexGrow: 1,
          minHeight: 120,
        },
        listContent: {
          paddingHorizontal: theme.spacing.md,
          paddingTop: 0,
          paddingBottom: theme.spacing.sm,
        },
        filteredEmpty: {
          flex: 1,
          paddingTop: theme.spacing.xl * 2,
          alignItems: 'center',
        },
        showAllBtn: {
          marginTop: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.xl,
          borderRadius: theme.radius.full,
        },
      }),
    [theme],
  );

  const handleFilterChange = useCallback(
    (zone: ZoneKey | 'all') => {
      onExitZoneClearMode();
      setFilterZone(zone);
    },
    [onExitZoneClearMode, setFilterZone]
  );

  const populatedZoneCount = useMemo(() => {
    let n = 0;
    for (const k in zoneCounts) if (zoneCounts[k as ZoneKey] > 0) n++;
    return n;
  }, [zoneCounts]);

  const reorderToolbar = useMemo(
    () => (reorderMode ? { onCancel: onReorderCancel, onDone: onReorderDone } : null),
    [reorderMode, onReorderCancel, onReorderDone]
  );

  const listHeader = useMemo(
    () => (
      <Pressable
        style={styles.listHeader}
        onPress={zoneClearMode && !reorderMode ? onExitZoneClearMode : undefined}
      >
        <View
          style={[styles.headerInteractiveBlock, reorderMode && styles.headerDimmed]}
          pointerEvents={reorderMode ? 'none' : 'auto'}
        >
          <ListStatsHeader
            totalItems={safeItems.length}
            zoneCounts={zoneCounts}
            zoneRemaining={zoneRemaining}
            hideStatPills
            filterZone={filterZone}
            onFilterChange={handleFilterChange}
            isShopMode={shoppingMode === 'shop'}
          />
        </View>
        <ListSummaryStrip
          mode={shoppingMode}
          totalItems={isFiltered ? filteredItems.length : safeItems.length}
          zoneCount={isFiltered ? filteredZoneCount : populatedZoneCount}
          itemsLeft={isFiltered ? filteredRemaining : remaining}
          sectionsLeft={isFiltered ? filteredSectionsLeft : sectionsLeft}
          nextSection={isFiltered ? null : nextSectionForSummary}
          onListActionsPress={reorderMode ? undefined : openListActionsSheet}
          reorderToolbar={reorderToolbar}
        />
      </Pressable>
    ),
    [
      styles.listHeader,
      styles.headerInteractiveBlock,
      styles.headerDimmed,
      zoneClearMode,
      reorderMode,
      onExitZoneClearMode,
      safeItems.length,
      zoneCounts,
      zoneRemaining,
      filterZone,
      handleFilterChange,
      shoppingMode,
      isFiltered,
      filteredItems.length,
      filteredZoneCount,
      populatedZoneCount,
      filteredRemaining,
      remaining,
      filteredSectionsLeft,
      sectionsLeft,
      nextSectionForSummary,
      openListActionsSheet,
      reorderToolbar,
    ]
  );

  const contentContainerStyle = useMemo(
    () => [
      styles.listContent,
      {
        paddingTop: scrollContentInsetTop,
        paddingBottom: listContentBottomPad,
        flexGrow: zoneClearMode && !reorderMode ? 1 : undefined,
      },
    ],
    [
      styles.listContent,
      scrollContentInsetTop,
      listContentBottomPad,
      zoneClearMode,
      reorderMode,
    ]
  );

  const renderZoneSection = useCallback(
    ({ item }: { item: HomeSectionItem }) => (
      <RenderZoneSection
        item={item}
        collapsed={collapsedZones.has(item.zone)}
        reduceMotion={reduceMotion}
        toggleZone={toggleZone}
        onToggleItem={handleToggle}
        onDeleteItem={requestDeleteListItem}
        onEditItem={openComposerForEdit}
        onRequestDeleteZone={requestDeleteZone}
        zoneClearMode={zoneClearMode}
        onEnterZoneClearMode={onEnterZoneClearMode}
        onExitZoneClearMode={onExitZoneClearMode}
        isCurrent={
          shoppingMode === 'shop' && (filterZone === 'all' ? item.zone === currentSection : true)
        }
        isShopMode={shoppingMode === 'shop'}
        remaining={shoppingMode === 'shop' ? zoneRemaining[item.zone] ?? 0 : 0}
        hideEditIcon={shoppingMode === 'shop'}
        linkedMealLabels={linkedMealLabels}
        zoneIconOverrides={zoneIconOverrides}
      />
    ),
    [
      collapsedZones,
      reduceMotion,
      toggleZone,
      handleToggle,
      requestDeleteListItem,
      openComposerForEdit,
      requestDeleteZone,
      zoneClearMode,
      onEnterZoneClearMode,
      onExitZoneClearMode,
      shoppingMode,
      filterZone,
      currentSection,
      zoneRemaining,
      linkedMealLabels,
      zoneIconOverrides,
    ]
  );

  if (reorderMode) {
    /** `DraggableFlatList` wraps the list in `Animated.View` using `containerStyle`; without flex:1 that wrapper has no height and the list collapses to blank. */
    const reorderData = reorderSections.length > 0 ? reorderSections : sections;

    return (
      <DraggableFlatList<HomeSectionItem>
        containerStyle={styles.list}
        style={styles.list}
        data={reorderData}
        extraData={`${reorderData.map((s) => s.zone).join(',')}-${reduceMotion}`}
        keyExtractor={(s) => s.zone}
        ListHeaderComponent={listHeader}
        onDragBegin={(index) => {
          reorderHaptics.light();
          lastPlaceholderIndexRef.current = index;
        }}
        onDragEnd={({ data }) => {
          setReorderSections(data);
          reorderHaptics.light();
          lastPlaceholderIndexRef.current = null;
        }}
        onPlaceholderIndexChange={(idx) => {
          if (lastPlaceholderIndexRef.current !== idx) {
            lastPlaceholderIndexRef.current = idx;
            reorderHaptics.selection();
          }
        }}
        renderItem={({ item, drag, isActive }) =>
          reduceMotion ? (
            <ReorderSectionRow
              zoneKey={item.zone}
              items={item.items}
              remaining={shoppingMode === 'shop' ? zoneRemaining[item.zone] ?? 0 : 0}
              isShopMode={shoppingMode === 'shop'}
              zoneIconOverrides={zoneIconOverrides}
              reduceMotion={reduceMotion}
              isActive={isActive}
              drag={drag}
            />
          ) : (
            <ScaleDecorator>
              <ReorderSectionRow
                zoneKey={item.zone}
                items={item.items}
                remaining={shoppingMode === 'shop' ? zoneRemaining[item.zone] ?? 0 : 0}
                isShopMode={shoppingMode === 'shop'}
                zoneIconOverrides={zoneIconOverrides}
                reduceMotion={reduceMotion}
                isActive={isActive}
                drag={drag}
              />
            </ScaleDecorator>
          )
        }
        contentContainerStyle={contentContainerStyle}
        contentInsetAdjustmentBehavior={Platform.OS === 'ios' ? 'never' : undefined}
        onScrollOffsetChange={(offset) => {
          listScrollShared.value = Math.max(0, offset);
        }}
      />
    );
  }

  return (
    <AnimatedFlatList
      style={styles.list}
      data={sections}
      extraData={extraData}
      keyExtractor={(s) => s.zone}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      ListHeaderComponent={listHeader}
      renderItem={renderZoneSection}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={themeAccent}
          progressViewOffset={Platform.OS === 'android' ? scrollContentInsetTop : undefined}
        />
      }
      contentContainerStyle={contentContainerStyle}
      contentInsetAdjustmentBehavior={Platform.OS === 'ios' ? 'never' : undefined}
      onScroll={listScrollHandler}
      scrollEventThrottle={16}
      initialNumToRender={6}
      maxToRenderPerBatch={6}
      windowSize={7}
      removeClippedSubviews={Platform.OS === 'android'}
      onScrollBeginDrag={zoneClearMode ? onExitZoneClearMode : undefined}
      ListFooterComponent={
        zoneClearMode ? (
          <Pressable
            onPress={onExitZoneClearMode}
            style={styles.zoneClearDismissFooter}
            accessibilityRole="button"
            accessibilityLabel="Dismiss clear section mode"
          />
        ) : null
      }
      ListEmptyComponent={
        filterZone !== 'all' && safeItems.length > 0 ? (
          <View style={styles.filteredEmpty}>
            <EmptyState
              icon="folder-open-outline"
              title={`No items in ${ZONE_LABELS[filterZone]}`}
              message="This section is empty."
              glass={false}
            />
            <Pressable
              onPress={() => setFilterZone('all')}
              style={[styles.showAllBtn, { backgroundColor: themeAccent }]}
            >
              <Text style={[theme.typography.subhead, { color: themeOnAccent }]}>Show all</Text>
            </Pressable>
          </View>
        ) : null
      }
    />
  );
}

type RenderZoneSectionProps = {
  item: HomeSectionItem;
  collapsed: boolean;
  reduceMotion: boolean;
  toggleZone: (zone: ZoneKey) => void;
  onToggleItem: (id: string, checked: boolean) => void;
  onDeleteItem: (id: string) => void;
  onEditItem: (item: ListItem) => void;
  onRequestDeleteZone: (zoneKey: ZoneKey) => void;
  zoneClearMode: ZoneKey | null;
  onEnterZoneClearMode: (zoneKey: ZoneKey) => void;
  onExitZoneClearMode: () => void;
  isCurrent: boolean;
  isShopMode: boolean;
  remaining: number;
  hideEditIcon: boolean;
  linkedMealLabels: Map<string, LinkedMealRowMeta>;
  zoneIconOverrides: ZoneIconOverrides;
};

/** Binds zone-specific callbacks with `useCallback` so the `ZoneSection` memo
 *  stays stable when unrelated parent props change (e.g. scroll state). */
const RenderZoneSection = React.memo(function RenderZoneSection({
  item,
  collapsed,
  reduceMotion,
  toggleZone,
  onToggleItem,
  onDeleteItem,
  onEditItem,
  onRequestDeleteZone,
  zoneClearMode,
  onEnterZoneClearMode,
  onExitZoneClearMode,
  isCurrent,
  isShopMode,
  remaining,
  hideEditIcon,
  linkedMealLabels,
  zoneIconOverrides,
}: RenderZoneSectionProps) {
  if (__DEV__) markRender('RenderZoneSection');
  const zone = item.zone;
  const handleToggleCollapsed = useCallback(() => toggleZone(zone), [toggleZone, zone]);
  const handleEnterZoneClearMode = useCallback(
    () => onEnterZoneClearMode(zone),
    [onEnterZoneClearMode, zone]
  );
  return (
    <ZoneSection
      zoneKey={zone}
      items={item.items}
      collapsed={collapsed}
      reduceMotion={reduceMotion}
      onToggleCollapsed={handleToggleCollapsed}
      onToggleItem={onToggleItem}
      onDeleteItem={onDeleteItem}
      onEditItem={onEditItem}
      onRequestDeleteZone={onRequestDeleteZone}
      zoneClearMode={zoneClearMode}
      onEnterZoneClearMode={handleEnterZoneClearMode}
      onExitZoneClearMode={onExitZoneClearMode}
      isCurrent={isCurrent}
      isShopMode={isShopMode}
      remaining={remaining}
      hideEditIcon={hideEditIcon}
      linkedMealLabels={linkedMealLabels}
      zoneIconOverrides={zoneIconOverrides}
    />
  );
});
