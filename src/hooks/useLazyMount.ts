import { useEffect, useState } from 'react';

/**
 * Returns `true` as long as the tracked element should remain mounted.
 *
 * - Flips to `true` immediately when `visible` becomes `true`.
 * - After `visible` flips to `false`, stays `true` for `unmountDelayMs` so the
 *   element can finish its exit animation, then unmounts.
 *
 * Use to lazy-mount sheets/modals/dialogs so their subtree isn't rendered
 * until the user actually opens them (saves mount/render cost on screen load).
 */
export function useLazyMount(visible: boolean, unmountDelayMs = 400): boolean {
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      return;
    }
    const t = setTimeout(() => setMounted(false), unmountDelayMs);
    return () => clearTimeout(t);
  }, [visible, unmountDelayMs]);

  return mounted;
}
