import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

/**
 * True when the user prefers reduced motion (iOS Reduce Motion or Reanimated hook).
 * Combines Reanimated’s sync with AccessibilityInfo for subscription to live changes.
 */
export function useReduceMotion(): boolean {
  const reanimatedRm = useReducedMotion() ?? false;
  const [a11yRm, setA11yRm] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (mounted) setA11yRm(v);
      })
      .catch(() => {});

    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
      setA11yRm(v);
    });

    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reanimatedRm || a11yRm;
}
