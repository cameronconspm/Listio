import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  hydrateThemePreference,
  normalizeThemePreference,
  readStoredThemePreference,
  resetSessionThemePreferenceForTests,
} from '../src/services/themePreferenceService';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock('../src/services/supabaseClient', () => ({
  isSyncEnabled: jest.fn(() => true),
  bootstrapSupabaseAuthSession: jest.fn(),
  getUserId: jest.fn(),
}));

jest.mock('../src/services/userPreferencesService', () => ({
  fetchUserPreferences: jest.fn(),
  patchUserPreferencesIfSync: jest.fn(),
}));

import { bootstrapSupabaseAuthSession, isSyncEnabled } from '../src/services/supabaseClient';
import { fetchUserPreferences } from '../src/services/userPreferencesService';

const getItemMock = AsyncStorage.getItem as jest.Mock;
const setItemMock = AsyncStorage.setItem as jest.Mock;
const bootstrapMock = bootstrapSupabaseAuthSession as jest.Mock;
const fetchPrefsMock = fetchUserPreferences as jest.Mock;
const isSyncEnabledMock = isSyncEnabled as jest.Mock;

describe('themePreferenceService', () => {
  beforeEach(() => {
    resetSessionThemePreferenceForTests();
    getItemMock.mockReset();
    setItemMock.mockReset();
    bootstrapMock.mockReset();
    fetchPrefsMock.mockReset();
    isSyncEnabledMock.mockReturnValue(true);
    bootstrapMock.mockResolvedValue({ session: null, clearedCorruptSession: false });
    getItemMock.mockResolvedValue(null);
    fetchPrefsMock.mockResolvedValue({});
  });

  it('normalizes invalid values to system', () => {
    expect(normalizeThemePreference('bogus')).toBe('system');
    expect(normalizeThemePreference('dark')).toBe('dark');
  });

  it('defaults to system when nothing is stored', async () => {
    await expect(readStoredThemePreference()).resolves.toBe('system');
  });

  it('waits for auth bootstrap before reading cloud prefs', async () => {
    bootstrapMock.mockResolvedValue({
      session: { user: { id: 'user-1' } },
      clearedCorruptSession: false,
    });
    fetchPrefsMock.mockResolvedValue({ appearance: { selectedTheme: 'dark' } });

    await expect(hydrateThemePreference()).resolves.toBe('dark');
    expect(bootstrapMock).toHaveBeenCalledTimes(1);
    expect(fetchPrefsMock).toHaveBeenCalledTimes(1);
  });

  it('uses local storage when signed out after auth bootstrap', async () => {
    getItemMock.mockResolvedValue('light');
    bootstrapMock.mockResolvedValue({ session: null, clearedCorruptSession: false });

    await expect(hydrateThemePreference()).resolves.toBe('light');
    expect(fetchPrefsMock).not.toHaveBeenCalled();
  });

  it('returns session cache without re-fetching for the same user', async () => {
    bootstrapMock.mockResolvedValue({
      session: { user: { id: 'user-1' } },
      clearedCorruptSession: false,
    });
    fetchPrefsMock.mockResolvedValue({ appearance: { selectedTheme: 'dark' } });

    await hydrateThemePreference();
    bootstrapMock.mockClear();
    fetchPrefsMock.mockClear();

    await expect(hydrateThemePreference()).resolves.toBe('dark');
    expect(fetchPrefsMock).not.toHaveBeenCalled();
  });

  it('re-hydrates when the signed-in user changes', async () => {
    bootstrapMock.mockResolvedValueOnce({
      session: { user: { id: 'user-1' } },
      clearedCorruptSession: false,
    });
    fetchPrefsMock.mockResolvedValueOnce({ appearance: { selectedTheme: 'dark' } });
    await hydrateThemePreference();

    bootstrapMock.mockResolvedValueOnce({
      session: { user: { id: 'user-2' } },
      clearedCorruptSession: false,
    });
    fetchPrefsMock.mockResolvedValueOnce({ appearance: { selectedTheme: 'light' } });

    await expect(hydrateThemePreference()).resolves.toBe('light');
    expect(fetchPrefsMock).toHaveBeenCalledTimes(2);
  });

  it('mirrors cloud preference into local storage', async () => {
    bootstrapMock.mockResolvedValue({
      session: { user: { id: 'user-1' } },
      clearedCorruptSession: false,
    });
    fetchPrefsMock.mockResolvedValue({ appearance: { selectedTheme: 'dark' } });

    await hydrateThemePreference();
    expect(setItemMock).toHaveBeenCalledWith('@listio/theme_preference', 'dark');
  });
});
