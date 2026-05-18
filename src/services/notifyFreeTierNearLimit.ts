import { showInfo } from '../utils/appToast';
import type { FreeTierKind } from './freeTierLimits';
import { freeTierUsageSummary } from './freeTierLimits';
import { markNearLimitToastShown, wasNearLimitToastShown } from './freeTierNearLimitStore';

const NEAR_LIMIT_TITLE = 'Almost at your free limit';

function nearLimitMessage(kind: FreeTierKind): string {
  switch (kind) {
    case 'list':
      return 'You have 1 item left on your free list. Listio+ adds unlimited items.';
    case 'meal':
      return 'You have 1 meal slot left on the free plan. Listio+ lets you plan your whole week.';
    case 'recipe':
      return 'You have 1 recipe slot left on the free plan. Listio+ saves unlimited recipes.';
    default:
      return 'You are almost at your free plan limit.';
  }
}

/** One-time info toast when the user reaches one slot before the free-tier cap. */
export async function notifyFreeTierNearLimitIfNeeded(
  kind: FreeTierKind,
  currentCount: number
): Promise<void> {
  const summary = freeTierUsageSummary(kind, currentCount);
  if (!summary.nearLimit) return;
  if (await wasNearLimitToastShown(kind)) return;
  await markNearLimitToastShown(kind);
  showInfo(nearLimitMessage(kind), NEAR_LIMIT_TITLE);
}
