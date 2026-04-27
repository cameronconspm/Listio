/**
 * Keep in sync with `src/utils/groceryPlaceClassification.ts` (copy for Edge runtime).
 */

const NON_GROCERY_TYPES = new Set([
  'lodging',
  'electronics_store',
  'car_dealer',
  'car_repair',
  'gas_station',
  'bank',
  'atm',
  'movie_theater',
  'night_club',
  'bar',
  'gym',
  'spa',
  'beauty_salon',
  'hair_care',
  'hospital',
  'doctor',
  'dentist',
  'veterinary_care',
  'real_estate_agency',
  'insurance_agency',
  'lawyer',
]);

const STRONG_GROCERY_TYPES = new Set([
  'supermarket',
  'grocery_store',
  'grocery_or_supermarket',
]);

const WHOLESALE_TYPE = 'wholesale';

export function normalizeForGroceryNameMatch(name: string): string {
  let s = name.normalize('NFKC').trim().toLowerCase();
  s = s.replace(/[\u2018\u2019\u201A\u2032\u2035\u02BC\uFF07]/g, "'");
  s = s.replace(/\s*&\s*/g, ' and ');
  s = s.replace(/\s*\+\s*/g, ' and ');
  s = s.replace(/\s+/g, ' ');
  return s.trim();
}

export function nameSuggestsNonGrocery(name: string): boolean {
  const n = normalizeForGroceryNameMatch(name);
  if (!n) return true;
  return (
    /\b(best buy|b and h photo|micro center|apple store|microsoft store|verizon|at and t|t-mobile)\b/.test(
      n
    ) ||
    /\b(hotel|motel|inn and suites|hampton inn|marriott|residence inn|holiday inn|hilton|hyatt|westin|sheraton|la quinta|comfort suites|springhill suites|courtyard by marriott|doubletree)\b/.test(
      n
    ) ||
    /\b(u-?haul|storage|self storage)\b/.test(n)
  );
}

export function nameSuggestsGroceryRetail(name: string): boolean {
  const n = normalizeForGroceryNameMatch(name);
  if (!n) return false;

  if (
    /\b(walmart|wal-mart|target|costco|whole foods|trader joe|sprouts|aldi|lidl|publix|kroger|safeway|albertsons|vons|ralphs|fry'?s (foods?|marketplace|market|stores?|food and drug)|food 4 less|king soopers|smith'?s marketplace|fred meyer|meijer|h-e-b|\bheb\b|winco|wegmans|stop and shop|giant (food|eagle)|food lion|shoprite|price chopper|market basket|fareway|hy-?vee|casey'?s|dollar general market)\b/.test(
      n
    )
  ) {
    return true;
  }

  if (/\b(sam'?s club|bj'?s wholesale|bj'?s club)\b/.test(n)) return true;

  if (/\b(99 ranch|hmart|h mart|mitsuwa|nijiya|patel brothers|india bazaar|mitsuwa marketplace)\b/.test(n)) {
    return true;
  }

  if (
    /\b(save mart|lucky (california|supermarket|market)|lucky'?s|stater bros|smart and final|grocery outlet|ralley'?s|nob hill|bel air (market|foods)|acme markets?|hannaford|shaw'?s|star market|tops friendly|weis markets|big y|roche bros)\b/.test(
      n
    )
  ) {
    return true;
  }

  if (
    /\b(winn-?dixie|harvey'?s supermarket|bi-?lo|ingles|piggly wiggly|food city|brookshire'?s|brookshire brothers|united supermarket|lowe'?s market|rosauers|haggen|dierbergs?|schnucks|jewel-?osco|mariano'?s|cub foods|county market|hornbacher'?s|strack and van til|family fare|spartan nash|coborn'?s|cash wise|festival foods|woodman'?s|sendik'?s|natural grocers|earth fare|fresh thyme)\b/.test(
      n
    )
  ) {
    return true;
  }

  if (/\b(supermarket|super center|supercenter|grocery|food mart|food market|fresh market|farmers market)\b/.test(n)) {
    return true;
  }
  return false;
}

export function isLikelyGroceryShoppingPlace(types: string[] | undefined, name: string): boolean {
  const t = types?.length ? types : [];
  const tset = new Set(t);
  const label = name ?? '';

  for (const g of STRONG_GROCERY_TYPES) {
    if (tset.has(g)) return true;
  }

  if (tset.has(WHOLESALE_TYPE)) return true;

  if (nameSuggestsNonGrocery(label)) return false;

  for (const bad of NON_GROCERY_TYPES) {
    if (tset.has(bad)) return false;
  }

  if (tset.has('department_store')) {
    if (nameSuggestsGroceryRetail(label)) return true;
    return false;
  }

  if (tset.has('shopping_mall')) return false;

  if (tset.has('convenience_store')) {
    return nameSuggestsGroceryRetail(label);
  }

  if (tset.has('store') && nameSuggestsGroceryRetail(label)) {
    if (tset.has('restaurant')) return false;
    return true;
  }

  if (nameSuggestsGroceryRetail(label)) {
    if (tset.has('restaurant') || tset.has('meal_takeaway') || tset.has('bakery')) {
      return false;
    }
    return true;
  }

  return false;
}
