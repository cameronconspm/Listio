import type { CategorizeItemResult } from '../types/api';
import type { ZoneKey } from '../types/models';
import { ZONE_LABELS } from '../data/zone';
import { showInfo } from '../utils/appToast';
import { resolveCategoryFast } from './aiCategoryCache';
import {
  categorizeItems,
  isAiRateLimitError,
  phraseKeyForCategorize,
  type CategorizeCallKind,
  type PremiumHint,
} from './aiService';

export type ResolveItemsForInsertOptions = {
  storeType?: string;
  zoneLabelsInOrder?: string[];
  zoneOverride?: ZoneKey | null;
  premiumHint?: PremiumHint;
  callKind?: CategorizeCallKind;
  /** When true, show info toast on fallback (default true). */
  showFallbackToast?: boolean;
};

export type ResolveItemsForInsertResult = {
  results: CategorizeItemResult[];
  didFallback: boolean;
  fallbackReason?: 'rate_limited' | 'error';
};

function buildFallbackResult(raw: string): CategorizeItemResult {
  const fast = resolveCategoryFast(raw);
  if (fast) {
    return {
      input: raw,
      normalized_name: phraseKeyForCategorize(raw),
      category: fast.category,
      zone_key: fast.zone_key,
      confidence: fast.confidence,
    };
  }
  return {
    input: raw,
    normalized_name: phraseKeyForCategorize(raw),
    category: 'other',
    zone_key: 'other',
    confidence: 0,
  };
}

export function categorizeFallbackToastMessage(reason: 'rate_limited' | 'error'): string {
  if (reason === 'rate_limited') {
    return 'Added to Other — smart section sorting is briefly paused. You can move items anytime.';
  }
  return "Added to Other — couldn't sort into sections right now.";
}

export function showCategorizeFallbackToast(reason: 'rate_limited' | 'error'): void {
  showInfo(categorizeFallbackToastMessage(reason), 'Added to list');
}

export async function resolveItemsForInsert(
  rawNames: string[],
  options: ResolveItemsForInsertOptions = {}
): Promise<ResolveItemsForInsertResult> {
  const {
    storeType,
    zoneLabelsInOrder,
    zoneOverride = null,
    premiumHint,
    callKind = 'submit',
    showFallbackToast = true,
  } = options;

  if (zoneOverride != null) {
    const results = rawNames.map((raw) => ({
      input: raw,
      normalized_name: phraseKeyForCategorize(raw),
      category: ZONE_LABELS[zoneOverride] ?? 'uncategorized',
      zone_key: zoneOverride,
      confidence: 1,
    }));
    return { results, didFallback: false };
  }

  try {
    const res = await categorizeItems(rawNames, storeType, zoneLabelsInOrder, {
      premiumHint,
      callKind,
    });
    if (res.results.length !== rawNames.length) {
      throw new Error('Couldn’t sort items into sections. Try again.');
    }
    return { results: res.results, didFallback: false };
  } catch (e) {
    const fallbackReason = isAiRateLimitError(e) ? 'rate_limited' : 'error';
    const results = rawNames.map(buildFallbackResult);
    if (showFallbackToast) {
      showCategorizeFallbackToast(fallbackReason);
    }
    return { results, didFallback: true, fallbackReason };
  }
}
