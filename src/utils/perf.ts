/**
 * Lightweight dev-only performance markers.
 *
 * All functions are no-ops in release builds so the bundle stays clean. In dev
 * they maintain a small ring buffer of render counts and timing samples so we
 * can reality-check optimization work without attaching Chrome/Flipper.
 *
 * Usage:
 *   markRender('ListItemRow'); // inside a component body
 *   const result = time('deriveHomeListModel', () => deriveHomeListModel(...));
 *   getPerfSnapshot(); // read counters (e.g. from a QA settings screen)
 */

type Counter = { count: number };
type Sample = { label: string; durationMs: number; at: number };

const renderCounts: Map<string, Counter> = new Map();
const SAMPLE_BUFFER_SIZE = 200;
const samples: Sample[] = [];

export function markRender(componentName: string): void {
  if (!__DEV__) return;
  const c = renderCounts.get(componentName);
  if (c) c.count++;
  else renderCounts.set(componentName, { count: 1 });
}

export function time<T>(label: string, fn: () => T): T {
  if (!__DEV__) return fn();
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
