import type { ComponentType } from 'react';
import * as Sentry from '@sentry/react-native';

let initialized = false;

function resolveDsn(): string {
  const raw = process.env.EXPO_PUBLIC_SENTRY_DSN;
  return typeof raw === 'string' ? raw.trim() : '';
}

/** True when a DSN is configured (Sentry may still be disabled in __DEV__ unless debug env is set). */
export function isSentryConfigured(): boolean {
  return resolveDsn().length > 0;
}

/**
 * Call once before the root component mounts. No-ops when EXPO_PUBLIC_SENTRY_DSN is unset.
 * Release builds use a modest trace sample rate; dev stays off unless EXPO_PUBLIC_SENTRY_DEBUG=1.
 */
export function initSentry(): void {
  if (initialized) return;
  const dsn = resolveDsn();
  if (!dsn) return;

  const debugInDev =
    __DEV__ &&
    (process.env.EXPO_PUBLIC_SENTRY_DEBUG?.trim().toLowerCase() === '1' ||
      process.env.EXPO_PUBLIC_SENTRY_DEBUG?.trim().toLowerCase() === 'true');

  Sentry.init({
    dsn,
    enabled: !__DEV__ || debugInDev,
    tracesSampleRate: __DEV__ ? 0 : 0.15,
    enableAutoSessionTracking: true,
    attachStacktrace: true,
  });
  initialized = true;
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        scope.setExtra(key, value);
      }
    }
    if (error instanceof Error) {
      Sentry.captureException(error);
    } else {
      Sentry.captureException(new Error(String(error)));
    }
  });
}

export function wrapWithSentry<P extends Record<string, unknown>>(
  component: ComponentType<P>
): ComponentType<P> {
  if (!isSentryConfigured()) return component;
  return Sentry.wrap(component) as ComponentType<P>;
}
