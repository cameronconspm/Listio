import type { StoreType } from '../types/models';

export const STORE_TYPES: StoreType[] = [
  'generic',
  'kroger_style',
  'albertsons_style',
  'wholefoods_style',
  'costco_style',
  'traderjoes_style',
];

export const STORE_TYPE_LABELS: Record<StoreType, string> = {
  generic: 'Generic',
  kroger_style: 'Kroger-style',
  albertsons_style: 'Albertsons-style',
  wholefoods_style: 'Whole Foods-style',
  costco_style: 'Costco-style',
  traderjoes_style: 'Trader Joe\'s-style',
};
