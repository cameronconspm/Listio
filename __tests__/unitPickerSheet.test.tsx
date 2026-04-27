import React from 'react';
import * as ReactNative from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { UnitPickerSheet } from '../src/components/ui/UnitPickerSheet';
import { SelectorRow } from '../src/components/ui/SelectorRow';

const mockReact = React;
const mockReactNative = ReactNative;

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

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

jest.mock('../src/hooks/useHaptics', () => ({
  useHaptics: () => ({
    light: jest.fn(),
    success: jest.fn(),
  }),
}));

describe('UnitPickerSheet', () => {
  it('selects unit and closes sheet', () => {
    const onClose = jest.fn();
    const onSelect = jest.fn();
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(<UnitPickerSheet visible onClose={onClose} value="ea" onSelect={onSelect} />);
    });

    const cupRow = tree.root
      .findAllByType(SelectorRow)
      .find((row: { props: { label?: string } }) => row.props.label === 'cup');

    expect(cupRow).toBeTruthy();

    act(() => {
      cupRow?.props.onPress();
    });

    expect(onSelect).toHaveBeenCalledWith('cup');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
