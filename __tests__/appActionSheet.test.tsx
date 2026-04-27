import React from 'react';
import * as ReactNative from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppActionSheet } from '../src/components/ui/AppActionSheet';

const mockReact = React;
const mockReactNative = ReactNative;

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

describe('AppActionSheet', () => {
  it('invokes onClose when backdrop is pressed', () => {
    const onClose = jest.fn();
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <AppActionSheet visible onClose={onClose} actions={[{ label: 'Rename list', onPress: jest.fn() }]} />
      );
    });

    act(() => {
      tree.root.findByProps({ testID: 'mock-sheet-backdrop' }).props.onPress();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes before running the selected action', () => {
    const calls: string[] = [];
    const onClose = jest.fn(() => calls.push('close'));
    const onAction = jest.fn(() => calls.push('action'));
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <AppActionSheet
          visible
          onClose={onClose}
          actions={[{ label: 'Rename list', onPress: onAction }]}
        />
      );
    });

    const actionRow = tree.root.findByProps({ accessibilityLabel: 'Rename list' });
    act(() => {
      actionRow.props.onPress();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['close', 'action']);
  });
});
