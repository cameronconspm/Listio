/** Optional hook for sign-out paths outside React (cleared when provider unmounts). */
let resetBootstrap: (() => void) | null = null;

export function registerAccountBootstrapReset(fn: () => void): void {
  resetBootstrap = fn;
}

export function unregisterAccountBootstrapReset(): void {
  resetBootstrap = null;
}

export function resetAccountBootstrapSession(): void {
  resetBootstrap?.();
}
