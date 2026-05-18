import React from 'react';
import * as ReactNative from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { BottomQuickAddBar } from '../src/components/list/BottomQuickAddBar';

const mockReact = React;
const mockReactNative = ReactNative;

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('@react-navigation/bottom-tabs', () => ({
  useBottomTabBarHeight: () => 64,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('../src/components/ui/GlassView', () => ({
  GlassView: ({ children }: { children: React.ReactNode }) =>
    mockReact.createElement(mockReactNative.View, null, children),
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

jest.mock('../src/hooks/useKeyboardFrameLift', () => ({
  COMPOSER_KEYBOARD_EDGE_GAP: 6,
  useKeyboardFrameLift: () => ({
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 70,
  }),
}));

jest.mock('listio-keyboard-composer', () => {
  const { View } = require('react-native');
  return {
    KeyboardComposerHost: ({ children, ...props }: { children?: React.ReactNode }) =>
      mockReact.createElement(View, props, children),
  };
});

jest.mock('../src/services/recentItemsStore', () => ({
  loadRecentItemsForSuggestions: jest.fn(async () => []),
}));

jest.mock('../src/services/aiService', () => ({
  categorizeItems: jest.fn(async () => ({ results: [], cache_hits: 0, cache_misses: 0 })),
}));

jest.mock('../src/services/aiCategoryCache', () => ({
  resolveCategoryFast: jest.fn(() => null),
}));

describe('BottomQuickAddBar', () => {
  it('submits a single item with selected unit', async () => {
    const onSubmit = jest.fn(async () => undefined);
    let tree!: ReactTestRenderer;

    await act(async () => {
      tree = create(<BottomQuickAddBar onSubmit={onSubmit} />);
    });

    act(() => {
      tree.root.findByProps({ accessibilityLabel: 'Change unit' }).props.onPress();
    });
    act(() => {
      tree.root.findByProps({ accessibilityLabel: 'Select oz' }).props.onPress();
    });
    act(() => {
      tree.root.findByProps({ placeholder: 'Add item' }).props.onChangeText('milk');
    });
    await act(async () => {
      tree.root.findByProps({ accessibilityLabel: 'Add item' }).props.onPress();
    });

    expect(onSubmit).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          name: 'Milk',
          quantity: 1,
          unit: 'oz',
        }),
      ],
      null,
      expect.objectContaining({
        onOptimisticListInsert: expect.any(Function),
      })
    );
  });

  it('uses the typed quantity for a single item', async () => {
    const onSubmit = jest.fn(async () => undefined);
    let tree!: ReactTestRenderer;

    await act(async () => {
      tree = create(<BottomQuickAddBar onSubmit={onSubmit} />);
    });

    act(() => {
      tree.root.findByProps({ accessibilityLabel: 'Edit quantity' }).props.onPress();
    });
    act(() => {
      const qtyInput = tree.root.findByProps({ keyboardType: 'decimal-pad' });
      qtyInput.props.onChangeText('3');
      qtyInput.props.onSubmitEditing();
    });
    act(() => {
      tree.root.findByProps({ placeholder: 'Add item' }).props.onChangeText('bananas');
    });
    await act(async () => {
      tree.root.findByProps({ accessibilityLabel: 'Add item' }).props.onPress();
    });

    expect(onSubmit).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          name: 'Bananas',
          quantity: 3,
          unit: 'ea',
        }),
      ],
      null,
      expect.objectContaining({
        onOptimisticListInsert: expect.any(Function),
      })
    );
  });

  it('fills the input when a suggestion row is tapped', async () => {
    const onSubmit = jest.fn(async () => undefined);
    let tree!: ReactTestRenderer;

    await act(async () => {
      tree = create(<BottomQuickAddBar onSubmit={onSubmit} listItemNames={['Salt', 'Salsa']} />);
    });

    act(() => {
      tree.root.findByProps({ placeholder: 'Add item' }).props.onChangeText('sal');
    });

    const suggestion = tree.root.findByProps({ accessibilityLabel: 'Use Salt' });
    expect(suggestion).toBeTruthy();

    act(() => {
      suggestion.props.onPress();
    });

    expect(tree.root.findByProps({ placeholder: 'Add item' }).props.value).toBe('Salt');
  });
});
