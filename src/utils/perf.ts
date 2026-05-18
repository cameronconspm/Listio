/**
 * Performance markers: full ring buffer in __DEV__; sampled Sentry spans in release when configured.
 */

type Counter = { count: number };
type Sample = { label: string; durationMs: number; at: number };

const renderCounts: Map<string, Counter> = new Map();
let appLaunchMs = Date.now();

/** Call once at JS entry (index.ts) before React mounts. */
export function markAppLaunch(): void {
  appLaunchMs = Date.now();
}
const SAMPLE_BUFFER_SIZE = 200;
const samples: Sample[] = [];

function resolveReleasePerfSampleRate(): number {
  const raw = process.env.EXPO_PUBLIC_SENTRY_PERF_SAMPLE_RATE?.trim();
  if (!raw) return 0.05;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function shouldRecordReleasePerfSpan(): boolean {
  if (__DEV__) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { isSentryConfigured } = require('../services/sentryService') as typeof import('../services/sentryService');
    if (!isSentryConfigured()) return false;
  } catch {
    return false;
  }
  return Math.random() < resolveReleasePerfSampleRate();
}

function runWithOptionalSentrySpan<T>(label: string, fn: () => T): T {
  if (!shouldRecordReleasePerfSpan()) return fn();
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/react-native') as typeof import('@sentry/react-native');
    return Sentry.startSpan({ name: label, op: 'app.perf' }, fn);
  } catch {
    return fn();
  }
}

async function runWithOptionalSentrySpanAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!shouldRecordReleasePerfSpan()) return fn();
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/react-native') as typeof import('@sentry/react-native');
    return Sentry.startSpan({ name: label, op: 'app.perf' }, fn);
  } catch {
    return fn();
  }
}

export function markRender(componentName: string): void {
  if (!__DEV__) return;
  const c = renderCounts.get(componentName);
  if (c) c.count++;
  else renderCounts.set(componentName, { count: 1 });
}

export function time<T>(label: string, fn: () => T): T {
  if (!__DEV__) return runWithOptionalSentrySpan(label, fn);
  const started = globalThis.performance?.now?.() ?? Date.now();
  try {
    return fn();
  } finally {
    const ended = globalThis.performance?.now?.() ?? Date.now();
    const durationMs = ended - started;
    if (samples.length >= SAMPLE_BUFFER_SIZE) samples.shift();
    samples.push({ label, durationMs, at: ended });
  }
}

export async function timeAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!__DEV__) return runWithOptionalSentrySpanAsync(label, fn);
  const started = globalThis.performance?.now?.() ?? Date.now();
  try {
    return await fn();
  } finally {
    const ended = globalThis.performance?.now?.() ?? Date.now();
    const durationMs = ended - started;
    if (samples.length >= SAMPLE_BUFFER_SIZE) samples.shift();
    samples.push({ label, durationMs, at: ended });
  }
}

export function getPerfSnapshot(): {
  renders: { component: string; count: number }[];
  samples: Sample[];
} {
  if (!__DEV__) return { renders: [], samples: [] };
  const renders = Array.from(renderCounts.entries())
    .map(([component, c]) => ({ component, count: c.count }))
    .sort((a, b) => b.count - a.count);
  return { renders, samples: samples.slice() };
}

export function resetPerfSnapshot(): void {
  if (!__DEV__) return;
  renderCounts.clear();
  samples.length = 0;
}

/** Record splash → first interactive navigation ready (release: sampled Sentry span). */
export function recordColdStartFromLaunch(): void {
  recordColdStartInteractive(Date.now() - appLaunchMs);
}

export function recordColdStartInteractive(durationMs: number): void {
  if (__DEV__) {
    if (samples.length >= SAMPLE_BUFFER_SIZE) samples.shift();
    samples.push({ label: 'app.cold_start', durationMs, at: Date.now() });
    return;
  }
  if (!shouldRecordReleasePerfSpan()) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/react-native') as typeof import('@sentry/react-native');
    Sentry.startSpan({ name: 'app.cold_start', op: 'app.lifecycle' }, (span) => {
      span.setAttribute('duration_ms', durationMs);
    });
  } catch {
    /* optional */
  }
}
