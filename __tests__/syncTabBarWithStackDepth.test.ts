import {
  createTabBarStyleHidden,
  createTabBarStyleVisible,
  TAB_BAR_CONTENT_HEIGHT,
} from '../src/navigation/tabBarLayout';
import { syncTabBarWithStackDepth } from '../src/navigation/syncTabBarWithStackDepth';

describe('tabBarLayout', () => {
  it('visible style includes tab content height and safe area', () => {
    expect(createTabBarStyleVisible(34).height).toBe(TAB_BAR_CONTENT_HEIGHT + 34);
  });

  it('hidden style avoids display none', () => {
    const hidden = createTabBarStyleHidden();
    expect(hidden).not.toHaveProperty('display', 'none');
    expect(hidden.height).toBe(0);
    expect(hidden.opacity).toBe(0);
  });
});

describe('syncTabBarWithStackDepth', () => {
  it('shows tab bar on stack root and hides when pushed', () => {
    const setOptions = jest.fn();
    const navigation = {
      getState: jest.fn(() => ({ index: 0 })),
      getParent: jest.fn(() => ({
        getState: jest.fn(() => ({ type: 'tab' })),
        setOptions,
      })),
    };

    syncTabBarWithStackDepth(navigation as never, 20);
    expect(setOptions).toHaveBeenCalledWith({
      tabBarStyle: createTabBarStyleVisible(20),
    });

    (navigation.getState as jest.Mock).mockReturnValue({ index: 1 });
    syncTabBarWithStackDepth(navigation as never, 20);
    expect(setOptions).toHaveBeenLastCalledWith({
      tabBarStyle: createTabBarStyleHidden(),
    });
  });

  it('no-ops when parent is not a tab navigator', () => {
    const setOptions = jest.fn();
    const navigation = {
      getState: jest.fn(() => ({ index: 0 })),
      getParent: jest.fn(() => ({
        getState: jest.fn(() => ({ type: 'stack' })),
        setOptions,
      })),
    };

    syncTabBarWithStackDepth(navigation as never, 20);
    expect(setOptions).not.toHaveBeenCalled();
  });
});
