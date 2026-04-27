import { registerAndSyncPushToken } from '../src/services/pushTokenService';
import { supabase } from '../src/services/supabaseClient';

const mockGetPermissionsAsync = jest.fn();
const mockRequestPermissionsAsync = jest.fn();
const mockGetExpoPushTokenAsync = jest.fn();

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissionsAsync(...args),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissionsAsync(...args),
  getExpoPushTokenAsync: (...args: unknown[]) => mockGetExpoPushTokenAsync(...args),
}));

jest.mock('expo-device', () => ({
  isDevice: true,
}));

jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        eas: { projectId: 'project-1' },
      },
    },
  },
}));

jest.mock('../src/services/supabaseClient', () => ({
  supabase: {
    from: jest.fn(),
  },
  getUserId: jest.fn().mockResolvedValue('user-1'),
  isSyncEnabled: () => true,
}));

const upsertMock = jest.fn().mockResolvedValue({ error: null });

beforeEach(() => {
  jest.clearAllMocks();
  (supabase.from as jest.Mock).mockReturnValue({ upsert: upsertMock });
  mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[test]' });
});

describe('registerAndSyncPushToken', () => {
  it('does not show the OS permission prompt by default', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'undetermined' });

    const token = await registerAndSyncPushToken();

    expect(token).toBeNull();
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockGetExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('syncs an existing granted token without prompting', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });

    const token = await registerAndSyncPushToken();

    expect(token).toBe('ExponentPushToken[test]');
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockGetExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'project-1' });
    expect(upsertMock).toHaveBeenCalled();
  });

  it('can prompt when called from an explicit opt-in flow', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'granted' });

    const token = await registerAndSyncPushToken({ promptForPermission: true });

    expect(token).toBe('ExponentPushToken[test]');
    expect(mockRequestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalled();
  });
});
