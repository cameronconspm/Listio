import { showInfo } from '../utils/appToast';
import type { FreeTierKind } from './freeTierLimits';
import { freeTierUsageSummary } from './freeTierLimits';
import { markNearLimitToastShown, wasNearLimitToastShown } from './freeTierNearLimitStore';

const NEAR_LIMIT_TITLE = 'One spot to go';

function nearLimitMessage(kind: FreeTierKind): string {
  switch (kind) {
    case 'list':
      return 'Just one spot left on your free list. Listio+ makes it unlimited.';
    case 'meal':
      return 'One meal slot left on the free plan. Listio+ opens up your whole week.';
    case 'recipe':
      return 'One recipe slot left on the free plan. Listio+ saves them all.';
    default:
      return "You're almost at your free limit.";
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
