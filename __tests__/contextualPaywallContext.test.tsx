import React from 'react';
import { Alert, Platform, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('../src/services/purchasesService', () => ({
  fetchPremiumEntitlementActive: jest.fn(async () => false),
  getRevenueCatIosApiKey: jest.fn(() => 'test-rc-key'),
  isRevenueCatNativeLayerSkipped: jest.fn(() => false),
  purchaseListioPlusPackage: jest.fn(async () => true),
  shouldEnforceIosSubscriptionGate: jest.fn(() => true),
}));

jest.mock('../src/services/listioPaywallOfferings', () => ({
  fetchListioPaywallOffering: jest.fn(async () => null),
  getPackageForPlan: jest.fn(),
}));

jest.mock('../src/services/subscriptionEntitlementSyncService', () => ({
  ensureServerSubscriptionMirror: jest.fn(async () => undefined),
}));

jest.mock('../src/services/restorePurchasesFlow', () => ({
  restorePurchasesWithUserFeedback: jest.fn(async () => false),
}));

jest.mock('../src/utils/appToast', () => ({
  showInfo: jest.fn(),
}));

jest.mock('../src/utils/logger', () => ({
  logger: { warnRelease: jest.fn() },
}));

jest.mock('../src/components/paywall/ListioPaywallSheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Jest mock factory
  const ReactActual = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Jest mock factory
  const { Text: RNText } = require('react-native');
  return {
    ListioPaywallSheet: ({ visible, previewOnly }: { visible: boolean; previewOnly?: boolean }) =>
      visible
        ? ReactActual.createElement(
            RNText,
            { testID: previewOnly ? 'paywall-preview' : 'paywall-live' },
            previewOnly ? 'preview' : 'live'
          )
        : null,
  };
});

jest.mock('../src/design/ThemeContext', () => ({
  useTheme: () => ({
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, base: 16 },
    radius: { full: 999, xl: 16 },
    typography: {},
    textPrimary: '#000',
    textSecondary: '#666',
    background: '#fff',
    surface: '#fff',
    accent: '#007',
    divider: '#ccc',
    shadows: { floating: {} },
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Jest mock factory
  const RN = require('react-native');
  return {
    default: { View: RN.View },
    FadeIn: { duration: () => ({}) },
    FadeInDown: { delay: () => ({}) },
    ZoomIn: { springify: () => ({ damping: () => ({ stiffness: () => ({ mass: () => ({}) }) }) }) },
    useReducedMotion: () => false,
  };
});

// eslint-disable-next-line import/first
import {
  ContextualPaywallProvider,
  useContextualPaywall,
} from '../src/context/ContextualPaywallContext';
// eslint-disable-next-line import/first
import {
  fetchPremiumEntitlementActive,
  getRevenueCatIosApiKey,
  shouldEnforceIosSubscriptionGate,
} from '../src/services/purchasesService';
// eslint-disable-next-line import/first
import { showInfo } from '../src/utils/appToast';

const mockFetchPremium = fetchPremiumEntitlementActive as jest.MockedFunction<
  typeof fetchPremiumEntitlementActive
>;
const mockGetApiKey = getRevenueCatIosApiKey as jest.MockedFunction<typeof getRevenueCatIosApiKey>;
const mockShouldEnforceGate = shouldEnforceIosSubscriptionGate as jest.MockedFunction<
  typeof shouldEnforceIosSubscriptionGate
>;
const mockShowInfo = showInfo as jest.MockedFunction<typeof showInfo>;

function Probe({ apiRef }: { apiRef: React.MutableRefObject<ReturnType<typeof useContextualPaywall> | null> }) {
  const value = useContextualPaywall();
  apiRef.current = value;
  return null;
}

describe('ContextualPaywallProvider', () => {
  const apiRef: { current: ReturnType<typeof useContextualPaywall> | null } = { current: null };
  let renderer: ReactTestRenderer;

  beforeEach(() => {
    jest.clearAllMocks();
    apiRef.current = null;
    mockFetchPremium.mockResolvedValue(false);
    mockShouldEnforceGate.mockReturnValue(true);
    mockGetApiKey.mockReturnValue('test-rc-key');
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    act(() => {
      renderer?.unmount();
    });
    jest.restoreAllMocks();
  });

  function mountProvider() {
    act(() => {
      renderer = create(
        <ContextualPaywallProvider>
          <Probe apiRef={apiRef} />
        </ContextualPaywallProvider>
      );
    });
    expect(apiRef.current).not.toBeNull();
  }

  it('opens the live paywall sheet when the user is eligible', async () => {
    mountProvider();
    await act(async () => {
      void apiRef.current!.presentPaywall('list_limit');
      await Promise.resolve();
    });
    expect(renderer.root.findByProps({ testID: 'paywall-live' })).toBeTruthy();
  });

  it('shows preview sheet without checking premium entitlement', async () => {
    mountProvider();
    await act(async () => {
      void apiRef.current!.presentPaywallPreview('smart_add');
      await Promise.resolve();
    });
    expect(mockFetchPremium).not.toHaveBeenCalled();
    expect(renderer.root.findByProps({ testID: 'paywall-preview' })).toBeTruthy();
  });

  it('skips live paywall with feedback when gate is disabled', async () => {
    mockShouldEnforceGate.mockReturnValue(false);
    mountProvider();
    let result = false;
    await act(async () => {
      result = await apiRef.current!.presentPaywall(null, { feedbackOnSkip: true });
    });
    expect(result).toBe(true);
    expect(mockShowInfo).toHaveBeenCalledWith(
      'Subscriptions are disabled in this build.',
      'Paywall skipped'
    );
    expect(renderer.root.findAllByType(Text).some((n) => n.props.testID === 'paywall-live')).toBe(
      false
    );
  });

  it('skips live paywall with feedback when already premium', async () => {
    mockFetchPremium.mockResolvedValue(true);
    mountProvider();
    let result = false;
    await act(async () => {
      result = await apiRef.current!.presentPaywall(null, { feedbackOnSkip: true });
    });
    expect(result).toBe(true);
    expect(mockShowInfo).toHaveBeenCalledWith(
      'You already have Listio+ on this device.',
      'Already subscribed'
    );
  });

  it('alerts when RevenueCat API key is missing', async () => {
    mockGetApiKey.mockReturnValue('');
    mountProvider();
    let result = true;
    await act(async () => {
      result = await apiRef.current!.presentPaywall();
    });
    expect(result).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Not configured',
      expect.stringContaining('App Store version')
    );
  });
});
