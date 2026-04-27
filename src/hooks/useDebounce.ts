import { useCallback, useRef } from 'react';

export function useDebounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  return useCallback(
    ((...args: unknown[]) => {
      if (timeout.current) clearTimeout(timeout.current);
      timeout.current = setTimeout(() => fnRef.current(...args), ms);
    }) as T,
    [ms]
  );
}
