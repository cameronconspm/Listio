import { Dimensions } from 'react-native';

// Stable logical width for ThemeProvider / layout metrics in tests (reference device class).
jest.spyOn(Dimensions, 'get').mockImplementation((dim) => {
  if (dim === 'window' || dim === 'screen') {
    return { width: 440, height: 900, scale: 2, fontScale: 1 };
  }
  // @ts-expect-error
  return Dimensions.get(dim);
});

// AsyncStorage's native module isn't available under jest; use the library's
// official in-memory mock so services that persist state (recent items,
// category cache, onboarding flags, etc.) behave realistically in tests.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
