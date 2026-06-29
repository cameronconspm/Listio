jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Jest mock factory
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('../src/services/userPreferencesService', () => ({
  fetchUserPreferences: jest.fn(async () => ({})),
  patchUserPreferencesIfSync: jest.fn(async () => undefined),
}));

jest.mock('../src/services/supabaseClient', () => ({
  isSyncEnabled: jest.fn(() => false),
}));

jest.mock('../src/services/sentryService', () => ({
  captureException: jest.fn(),
}));

/* eslint-disable import/first -- jest.mock is hoisted */
import {
  logFunnelEvent,
  __resetFunnelAnalyticsForTests,
} from '../src/services/funnelAnalyticsService';
import { patchUserPreferencesIfSync } from '../src/services/userPreferencesService';

describe('funnelAnalyticsService', () => {
  beforeEach(async () => {
    await __resetFunnelAnalyticsForTests();
    jest.clearAllMocks();
  });

  it('queues welcome intro events locally when sync is off', async () => {
    logFunnelEvent('welcome_intro_complete');
    await new Promise((r) => setTimeout(r, 0));
    expect(patchUserPreferencesIfSync).not.toHaveBeenCalled();
  });
});
