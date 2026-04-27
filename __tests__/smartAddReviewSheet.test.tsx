import React from 'react';
import * as ReactNative from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SmartAddReviewSheet } from '../src/components/list/SmartAddReviewSheet';
import type { ParsedListItem } from '../src/types/api';

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
    children,
  }: {
    visible: boolean;
    children: React.ReactNode;
  }) => {
    return visible ? mockReact.createElement(mockReactNative.View, null, children) : null;
  },
}));

jest.mock('../src/components/ui/PrimaryButton', () => ({
  PrimaryButton: ({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) => {
    return mockReact.createElement(
      mockReactNative.Pressable,
      { accessibilityLabel: title, onPress, accessibilityState: { disabled } },
      mockReact.createElement(mockReactNative.Text, null, title)
    );
  },
}));

jest.mock('../src/hooks/useHaptics', () => ({
  useHaptics: () => ({
    light: jest.fn(),
    success: jest.fn(),
  }),
}));

const seed: ParsedListItem[] = [
  {
    name: 'Milk',
    normalized_name: 'milk',
    quantity: 1,
    unit: 'gal',
    zone_key: 'dairy_eggs',
    category: 'Dairy',
  },
  {
    name: 'Chicken breasts',
    normalized_name: 'chicken breasts',
    quantity: 2,
    unit: 'lb',
    zone_key: 'meat_seafood',
    category: 'Meat',
  },
  {
    name: 'Avocados',
    normalized_name: 'avocados',
    quantity: 3,
    unit: 'ea',
    zone_key: 'produce',
    category: 'Produce',
  },
];

describe('SmartAddReviewSheet', () => {
  it('renders one row per parsed item with section chip label', () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <SmartAddReviewSheet
          visible
          items={seed}
          onCancel={jest.fn()}
          onConfirm={jest.fn(async () => undefined)}
        />
      );
    });

    expect(tree.root.findByProps({ accessibilityLabel: 'Section Dairy & Eggs' })).toBeTruthy();
    expect(tree.root.findByProps({ accessibilityLabel: 'Section Meat & Seafood' })).toBeTruthy();
    expect(tree.root.findByProps({ accessibilityLabel: 'Section Produce' })).toBeTruthy();
  });

  it('removes a row when the trash button is tapped', () => {
    const onConfirm = jest.fn(async () => undefined);
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <SmartAddReviewSheet visible items={seed} onCancel={jest.fn()} onConfirm={onConfirm} />
      );
    });

    act(() => {
      tree.root.findByProps({ accessibilityLabel: 'Remove Chicken breasts' }).props.onPress();
    });

    expect(tree.root.findByProps({ accessibilityLabel: 'Add 2 items' })).toBeTruthy();
  });

  it('passes edited quantities + remaining rows to onConfirm', async () => {
    const onConfirm = jest.fn(async (_items: ParsedListItem[]) => undefined);
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <SmartAddReviewSheet visible items={seed} onCancel={jest.fn()} onConfirm={onConfirm} />
      );
    });

    act(() => {
      // Remove middle row.
      tree.root.findByProps({ accessibilityLabel: 'Remove Chicken breasts' }).props.onPress();
    });

    await act(async () => {
      tree.root.findByProps({ accessibilityLabel: 'Add 2 items' }).props.onPress();
      await Promise.resolve();
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const payload = onConfirm.mock.calls[0][0];
    expect(payload.map((r: ParsedListItem) => r.name)).toEqual(['Milk', 'Avocados']);
    expect(payload.map((r: ParsedListItem) => r.zone_key)).toEqual(['dairy_eggs', 'produce']);
  });

  it('shows "No items" copy and disables CTA when every row removed', () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <SmartAddReviewSheet visible items={[seed[0]]} onCancel={jest.fn()} onConfirm={jest.fn(async () => undefined)} />
      );
    });

    act(() => {
      tree.root.findByProps({ accessibilityLabel: 'Remove Milk' }).props.onPress();
    });

    const cta = tree.root.findByProps({ accessibilityLabel: 'Add 0 items' });
    expect(cta.props.accessibilityState?.disabled).toBe(true);
  });
});
