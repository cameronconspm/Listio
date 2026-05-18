import React from 'react';
import * as ReactNative from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppActionSheet } from '../src/components/ui/AppActionSheet';

const mockReact = React;
const mockReactNative = ReactNative;
let platformOS = 'android';

Object.defineProperty(ReactNative.Platform, 'OS', {
  configurable: true,
  get: () => platformOS,
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

describe('AppActionSheet', () => {
  beforeEach(() => {
    platformOS = 'android';
    jest.clearAllMocks();
  });

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

  it('uses ActionSheetIOS for native iOS option lists', () => {
    platformOS = 'ios';
    const onClose = jest.fn();
    const onAction = jest.fn();
    const showActionSheetSpy = jest
      .spyOn(ReactNative.ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation((_options, callback) => callback(0));

    act(() => {
      create(
        <AppActionSheet
          visible
          onClose={onClose}
          title="Recipe"
          actions={[
            { label: 'Share recipe', onPress: onAction },
            { label: 'Delete recipe', onPress: jest.fn(), destructive: true },
          ]}
        />
      );
    });

    expect(showActionSheetSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Recipe',
        options: ['Share recipe', 'Delete recipe', 'Cancel'],
        cancelButtonIndex: 2,
        destructiveButtonIndex: 1,
      }),
      expect.any(Function)
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
