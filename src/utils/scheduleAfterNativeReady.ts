import { InteractionManager } from 'react-native';

/**
 * Expo / RN native modules (TurboModules) are not always reachable on the first
 * `requestAnimationFrame` after mount — especially in `executionEnvironment: bare`
 * (dev client / custom native). Symptoms: `require('expo-*')` returns only `{ default }`
 * with no real APIs, or "runtime not ready" / "Cannot find native module".
 *
 * `InteractionManager.runAfterInteractions` runs after the native event queue has settled,
 * then one `requestAnimationFrame` aligns with the next paint (bridge + module registry).
 */
export function scheduleAfterNativeReady(fn: () => void): { cancel: () => void } {
  const interaction = InteractionManager.runAfterInteractions(() => {
    requestAnimationFrame(fn);
  });
  return {
    cancel: () => {
      interaction.cancel();
    },
  };
}
