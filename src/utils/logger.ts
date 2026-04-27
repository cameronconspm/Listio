export const logger = {
  info: (...args: unknown[]) => __DEV__ && console.log('[Listio]', ...args),
  warn: (...args: unknown[]) => __DEV__ && console.warn('[Listio]', ...args),
  error: (...args: unknown[]) => __DEV__ && console.error('[Listio]', ...args),
  /** Recoverable issues worth seeing in release device logs (Xcode / adb). */
  warnRelease: (...args: unknown[]) => console.warn('[Listio]', ...args),
};

/**
 * Uncaught render errors (e.g. error boundary). Always logs to the device console.
 * Wire `Sentry.captureException(error, { extra: context })` (or similar) here when you add a crash SDK.
 */
export function reportAppError(error: unknown, context?: Record<string, unknown>): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error('[Listio]', 'reportAppError', message, context ?? {}, stack ?? '');
}
