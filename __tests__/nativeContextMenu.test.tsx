import React from 'react';
import * as ReactNative from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { NativeContextMenu } from '../src/components/ui/NativeContextMenu';

const mockReact = React;
const mockReactNative = ReactNative;
let platformOS = 'web';

Object.defineProperty(ReactNative.Platform, 'OS', {
  configurable: true,
  get: () => platformOS,
});

jest.mock('@react-native-menu/menu', () => ({
  MenuView: ({
    children,
    onPressAction,
  }: {
    children: React.ReactNode;
    onPressAction: (event: { nativeEvent: { event: string } }) => void;
  }) =>
    mockReact.createElement(
      mockReactNative.Pressable,
      {
        accessibilityLabel: 'Native menu trigger',
        onPress: () => onPressAction({ nativeEvent: { event: 'delete' } }),
      },
      children
    ),
}));

jest.mock('../src/components/ui/BottomSheet', () => ({
  BottomSheet: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
    visible ? mockReact.createElement(mockReactNative.View, null, children) : null,
}));

describe('NativeContextMenu', () => {
  beforeEach(() => {
    platformOS = 'ios';
  });

  it('runs the selected native menu action', () => {
    const onAction = jest.fn();
    let tree!: ReactTestRenderer;

    act(() => {
      tree = create(
        <NativeContextMenu
          accessibilityLabel="More options"
          actions={[{ id: 'delete', label: 'Delete recipe', destructive: true, onPress: onAction }]}
        >
          <ReactNative.Text>More</ReactNative.Text>
        </NativeContextMenu>
      );
    });

    act(() => {
      tree.root.findByProps({ accessibilityLabel: 'Native menu trigger' }).props.onPress();
    });

    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
