import React from 'react';
import * as ReactNative from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QuickAddComposer } from '../src/components/list/QuickAddComposer';
import { UnitSelectionList } from '../src/components/ui/UnitSelectionList';

const mockReact = React;
const mockReactNative = ReactNative;

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('react-native-gesture-handler', () => {
  const reactNativeActual = jest.requireActual('react-native') as typeof import('react-native');
  return {
    ScrollView: reactNativeActual.ScrollView,
    Pressable: reactNativeActual.Pressable,
  };
});

jest.mock('../src/components/ui/BottomSheet', () => ({
  BottomSheet: ({
    visible,
    onClose,
    children,
  }: {
    visible: boolean;
    onClose: () => void;
    children: React.ReactNode;
  }) => {
    return visible
      ? mockReact.createElement(
          mockReactNative.View,
          null,
          mockReact.createElement(mockReactNative.Pressable, {
            testID: 'mock-sheet-backdrop',
            onPress: onClose,
          }),
          children
        )
      : null;
  },
}));

jest.mock('../src/components/ui/PrimaryButton', () => ({
  PrimaryButton: ({ title, onPress }: { title: string; onPress: () => void }) => {
    return mockReact.createElement(
      mockReactNative.Pressable,
      { accessibilityLabel: title, onPress },
      mockReact.createElement(mockReactNative.Text, null, title)
    );
  },
}));

jest.mock('../src/components/ui/AppConfirmationDialog', () => ({
  AppConfirmationDialog: () => null,
}));

jest.mock('../src/hooks/useHaptics', () => ({
  useHaptics: () => ({
    light: jest.fn(),
    success: jest.fn(),
  }),
}));

jest.mock('../src/hooks/useRecentSuggestions', () => ({
  useRecentSuggestions: () => [],
}));

jest.mock('../src/components/list/ListItemZoneSheet', () => ({
  ListItemZonePickerPanel: () => {
    return mockReact.createElement(mockReactNative.Text, { testID: 'mock-zone-picker' }, 'Zone picker');
  },
}));

jest.mock('../src/services/aiService', () => ({
  parseListItemsFromText: jest.fn(),
  categorizeItems: jest.fn(async () => ({ results: [], cache_hits: 0, cache_misses: 0 })),
}));

jest.mock('../src/components/list/SmartAddReviewSheet', () => ({
  SmartAddReviewSheet: ({ visible }: { visible: boolean }) => {
    return visible
      ? mockReact.createElement(mockReactNative.Text, { testID: 'mock-smart-review' }, 'review')
      : null;
  },
}));

describe('QuickAddComposer presentation behavior', () => {
  it('toggles optional details for add flow', () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <QuickAddComposer visible onDismiss={jest.fn()} onSubmit={jest.fn(async () => undefined)} />
      );
    });

    const showDetails = tree.root.findByProps({ accessibilityLabel: 'Add optional details' });
    act(() => {
      showDetails.props.onPress();
    });

    expect(tree.root.findByProps({ accessibilityLabel: 'Hide optional details' })).toBeTruthy();
  });

  it('does not keep unit and zone overlays open together', () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <QuickAddComposer visible onDismiss={jest.fn()} onSubmit={jest.fn(async () => undefined)} />
      );
    });

    act(() => {
      tree.root.findByProps({ accessibilityLabel: 'Change unit' }).props.onPress();
    });
    expect(tree.root.findAllByType(UnitSelectionList)).toHaveLength(1);

    act(() => {
      tree.root.findByProps({ accessibilityLabel: 'Change store section' }).props.onPress();
    });
    expect(tree.root.findAllByType(UnitSelectionList)).toHaveLength(0);
    expect(tree.root.findByProps({ testID: 'mock-zone-picker' })).toBeTruthy();
  });

  it('hides sparkle toggle when editing an existing item', () => {
    const item = {
      id: 'i1',
      user_id: 'u',
      name: 'Milk',
      normalized_name: 'milk',
      category: 'Dairy',
      zone_key: 'dairy_eggs' as const,
      quantity_value: 1,
      quantity_unit: 'gal',
      notes: null,
      is_checked: false,
      linked_meal_ids: [],
      brand_preference: null,
      substitute_allowed: true,
      priority: 'normal' as const,
      is_recurring: false,
      created_at: '',
      updated_at: '',
    };
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <QuickAddComposer
          visible
          onDismiss={jest.fn()}
          onSubmit={jest.fn(async () => undefined)}
          editingItem={item}
          onBulkAddPreCategorized={jest.fn(async () => undefined)}
        />
      );
    });

    expect(tree.root.findAllByProps({ testID: 'quick-add-sparkle-toggle' })).toHaveLength(0);
  });

  it('shows sparkle toggle only when onBulkAddPreCategorized is provided', () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <QuickAddComposer visible onDismiss={jest.fn()} onSubmit={jest.fn(async () => undefined)} />
      );
    });
    expect(tree.root.findAllByProps({ testID: 'quick-add-sparkle-toggle' })).toHaveLength(0);

    act(() => {
      tree.update(
        <QuickAddComposer
          visible
          onDismiss={jest.fn()}
          onSubmit={jest.fn(async () => undefined)}
          onBulkAddPreCategorized={jest.fn(async () => undefined)}
        />
      );
    });
    expect(tree.root.findByProps({ testID: 'quick-add-sparkle-toggle' })).toBeTruthy();
  });

  it('flips CTA label and hides qty row when smart mode is on', () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <QuickAddComposer
          visible
          onDismiss={jest.fn()}
          onSubmit={jest.fn(async () => undefined)}
          onBulkAddPreCategorized={jest.fn(async () => undefined)}
        />
      );
    });

    expect(tree.root.findByProps({ accessibilityLabel: 'Add item' })).toBeTruthy();
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Decrease quantity' }).length).toBeGreaterThan(0);

    act(() => {
      tree.root.findByProps({ testID: 'quick-add-sparkle-toggle' }).props.onPress();
    });

    expect(tree.root.findByProps({ accessibilityLabel: 'Parse with AI' })).toBeTruthy();
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Decrease quantity' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Change store section' })).toHaveLength(0);
  });

  describe('typing-time pre-warm', () => {
    const getCategorizeMock = () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const aiService = require('../src/services/aiService');
      return aiService.categorizeItems as jest.Mock;
    };

    const flushMicrotasks = async () => {
      // Dynamic import() in the pre-warm effect resolves across a couple of
      // microtask boundaries; give it plenty of ticks to settle.
      for (let i = 0; i < 32; i++) {
        await Promise.resolve();
      }
    };

    beforeEach(() => {
      getCategorizeMock().mockClear();
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('fires categorizeItems once after 600ms pause on a plausible item name', async () => {
      let tree!: ReactTestRenderer;
      act(() => {
        tree = create(
          <QuickAddComposer
            visible
            onDismiss={jest.fn()}
            onSubmit={jest.fn(async () => undefined)}
            storeType="generic"
            zoneLabelsInOrder={['Produce']}
          />
        );
      });

      act(() => {
        tree.root.findByProps({ testID: 'quick-add-item-input' }).props.onChangeText('milk');
      });

      act(() => {
        jest.advanceTimersByTime(599);
      });
      expect(getCategorizeMock()).not.toHaveBeenCalled();

      await act(async () => {
        jest.advanceTimersByTime(2);
        await flushMicrotasks();
      });

      expect(getCategorizeMock()).toHaveBeenCalledTimes(1);
      expect(getCategorizeMock()).toHaveBeenCalledWith(['milk'], 'generic', ['Produce']);
    });

    it('does not fire for inputs shorter than 3 characters', async () => {
      let tree!: ReactTestRenderer;
      act(() => {
        tree = create(
          <QuickAddComposer visible onDismiss={jest.fn()} onSubmit={jest.fn(async () => undefined)} />
        );
      });

      act(() => {
        tree.root.findByProps({ testID: 'quick-add-item-input' }).props.onChangeText('mi');
      });

      await act(async () => {
        jest.advanceTimersByTime(1200);
        await flushMicrotasks();
      });

      expect(getCategorizeMock()).not.toHaveBeenCalled();
    });

    it('debounces: only fires the latest value when the user keeps typing', async () => {
      let tree!: ReactTestRenderer;
      act(() => {
        tree = create(
          <QuickAddComposer visible onDismiss={jest.fn()} onSubmit={jest.fn(async () => undefined)} />
        );
      });

      const input = tree.root.findByProps({ testID: 'quick-add-item-input' });

      act(() => {
        input.props.onChangeText('milk');
      });
      act(() => {
        jest.advanceTimersByTime(300);
      });
      act(() => {
        input.props.onChangeText('milkshake');
      });

      await act(async () => {
        jest.advanceTimersByTime(700);
        await flushMicrotasks();
      });

      expect(getCategorizeMock()).toHaveBeenCalledTimes(1);
      expect(getCategorizeMock()).toHaveBeenCalledWith(['milkshake'], undefined, undefined);
    });

    it('does not fire in smart mode', async () => {
      let tree!: ReactTestRenderer;
      act(() => {
        tree = create(
          <QuickAddComposer
            visible
            onDismiss={jest.fn()}
            onSubmit={jest.fn(async () => undefined)}
            onBulkAddPreCategorized={jest.fn(async () => undefined)}
          />
        );
      });

      act(() => {
        tree.root.findByProps({ testID: 'quick-add-sparkle-toggle' }).props.onPress();
      });

      act(() => {
        tree.root.findByProps({ testID: 'quick-add-item-input' }).props.onChangeText('milk');
      });

      await act(async () => {
        jest.advanceTimersByTime(1200);
        await flushMicrotasks();
      });

      expect(getCategorizeMock()).not.toHaveBeenCalled();
    });

    it('does not fire when editing an existing item', async () => {
      const item = {
        id: 'i1',
        user_id: 'u',
        name: 'Milk',
        normalized_name: 'milk',
        category: 'Dairy',
        zone_key: 'dairy_eggs' as const,
        quantity_value: 1,
        quantity_unit: 'gal',
        notes: null,
        is_checked: false,
        linked_meal_ids: [],
        brand_preference: null,
        substitute_allowed: true,
        priority: 'normal' as const,
        is_recurring: false,
        created_at: '',
        updated_at: '',
      };
      let tree!: ReactTestRenderer;
      act(() => {
        tree = create(
          <QuickAddComposer
            visible
            onDismiss={jest.fn()}
            onSubmit={jest.fn(async () => undefined)}
            editingItem={item}
          />
        );
      });

      act(() => {
        tree.root.findByProps({ testID: 'quick-add-item-input' }).props.onChangeText('cheddar cheese');
      });

      await act(async () => {
        jest.advanceTimersByTime(1200);
        await flushMicrotasks();
      });

      expect(getCategorizeMock()).not.toHaveBeenCalled();
    });

    it('does not fire on multi-item comma-separated entries', async () => {
      let tree!: ReactTestRenderer;
      act(() => {
        tree = create(
          <QuickAddComposer visible onDismiss={jest.fn()} onSubmit={jest.fn(async () => undefined)} />
        );
      });

      act(() => {
        tree.root.findByProps({ testID: 'quick-add-item-input' }).props.onChangeText('milk, eggs, bread');
      });

      await act(async () => {
        jest.advanceTimersByTime(1200);
        await flushMicrotasks();
      });

      expect(getCategorizeMock()).not.toHaveBeenCalled();
    });
  });

  it('dismisses from explicit cancel affordance', () => {
    const onDismiss = jest.fn();
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <QuickAddComposer visible onDismiss={onDismiss} onSubmit={jest.fn(async () => undefined)} />
      );
    });

    act(() => {
      tree.root.findByProps({ accessibilityLabel: 'Cancel' }).props.onPress();
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
