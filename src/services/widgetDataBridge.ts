/**
 * Widget Data Bridge — writes app state to the shared App Group UserDefaults
 * so the iOS home screen widget can read it without launching the app.
 *
 * App Group: group.com.cameroncons.listio
 *
 * Data written (JSON string under key "listio_widget_data"):
 *   listCount        — number of unchecked list items
 *   runCount         — all-time shop run completions
 *   streakWeeks      — current consecutive-week streak
 *   lastRunAt        — ISO string of last completed run (or null)
 *   updatedAt        — ISO string when this data was last written
 */
import { NativeModules, Platform } from 'react-native';

const APP_GROUP_ID = 'group.com.cameroncons.listio';
const WIDGET_DEFAULTS_KEY = 'listio_widget_data';

export type WidgetData = {
  listCount: number;
  runCount: number;
  streakWeeks: number;
  lastRunAt: string | null;
  updatedAt: string;
};

/**
 * Write widget data to the shared UserDefaults suite.
 * Only available on iOS — silently no-ops on Android or when the
 * ListioWidgetBridge native module is absent (e.g. Expo Go).
 */
export async function writeWidgetData(data: Omit<WidgetData, 'updatedAt'>): Promise<void> {
  if (Platform.OS !== 'ios') return;

  const bridge = NativeModules.ListioWidgetBridge as
    | { setWidgetData: (appGroup: string, key: string, json: string) => void }
    | undefined;

  if (!bridge?.setWidgetData) return; // native module not linked yet

  const payload: WidgetData = {
    ...data,
    updatedAt: new Date().toISOString(),
  };

  try {
    bridge.setWidgetData(APP_GROUP_ID, WIDGET_DEFAULTS_KEY, JSON.stringify(payload));
  } catch {
    // Non-fatal — widget just shows stale data
  }
}
