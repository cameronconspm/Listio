import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import * as ReactNative from 'react-native';
import { LogBox } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import App from './src/App';

// Keep the native launch screen visible until React renders the first frame.
// Hiding happens in src/App.tsx after the root tree mounts. This prevents the
// blank/default iOS launch screen flash between the storyboard and JS paint.
void SplashScreen.preventAutoHideAsync().catch(() => {
  /* splash may already be hidden on fast devices; ignore */
});

// GoTrue logs console.error on invalid/revoked refresh tokens during init before the app can handle
// getSession(); sequential bootstrap in App.tsx clears storage, but the SDK still prints once.
if (__DEV__) {
  LogBox.ignoreLogs([/AuthApiError.*Invalid Refresh Token/i, /Refresh Token Not Found/i]);
}

// Polyfill: some packages still read `SafeAreaView` from `react-native`.
// Newer RN exposes `SafeAreaView` as a getter-only export; assigning throws ("only a getter").
// Only patch when nothing is exposed; we cannot override the deprecated RN component safely here.
const RN = ReactNative as Record<string, unknown>;
if (!RN.SafeAreaView) {
  try {
    RN.SafeAreaView = SafeAreaView;
  } catch {
    /* ignore */
  }
}

// Do not import expo-notifications at module load — it pulls in ExpoPushTokenManager before
// the native runtime is ready and can white-screen release builds / Expo sim. Handler is set in App.tsx.

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
