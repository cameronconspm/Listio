/**
 * Shared grocery catalog + tokenization + exact/partial/fuzzy resolution for the app and
 * `categorize-items`. Single module avoids Deno/TS `.ts` extension friction on cross-imports.
 */

export type CommonGroceryZoneKey =
  | 'produce'
  | 'bakery_deli'
  | 'meat_seafood'
  | 'dairy_eggs'
  | 'frozen'
  | 'pantry'
  | 'snacks_drinks'
  | 'household_cleaning'
  | 'personal_care'
  | 'other';

export type CommonGroceryCatalogEntry = {
  normalized_name: string;
  zone_key: CommonGroceryZoneKey;
  category: string;
  aliases: string[];
};

export const COMMON_GROCERY_CATALOG: CommonGroceryCatalogEntry[] = [
  { normalized_name: 'milk', category: 'Dairy', zone_key: 'dairy_eggs', aliases: ['milk', 'whole milk', '2 percent milk', 'skim milk'] },
  { normalized_name: 'eggs', category: 'Eggs', zone_key: 'dairy_eggs', aliases: ['eggs', 'egg'] },
  { normalized_name: 'butter', category: 'Dairy', zone_key: 'dairy_eggs', aliases: ['butter'] },
  { normalized_name: 'cheese', category: 'Cheese', zone_key: 'dairy_eggs', aliases: ['cheese', 'cheddar cheese', 'mozzarella cheese', 'shredded cheese'] },
  { normalized_name: 'yogurt', category: 'Dairy', zone_key: 'dairy_eggs', aliases: ['yogurt', 'greek yogurt'] },
  { normalized_name: 'bananas', category: 'Fruit', zone_key: 'produce', aliases: ['banana', 'bananas'] },
  { normalized_name: 'apples', category: 'Fruit', zone_key: 'produce', aliases: ['apple', 'apples'] },
  { normalized_name: 'avocados', category: 'Produce', zone_key: 'produce', aliases: ['avocado', 'avocados'] },
  { normalized_name: 'lettuce', category: 'Vegetables', zone_key: 'produce', aliases: ['lettuce', 'romaine lettuce', 'iceberg lettuce'] },
  { normalized_name: 'spinach', category: 'Vegetables', zone_key: 'produce', aliases: ['spinach', 'baby spinach'] },
  { normalized_name: 'tomatoes', category: 'Vegetables', zone_key: 'produce', aliases: ['tomato', 'tomatoes'] },
  { normalized_name: 'onions', category: 'Vegetables', zone_key: 'produce', aliases: ['onion', 'onions'] },
  { normalized_name: 'potatoes', category: 'Vegetables', zone_key: 'produce', aliases: ['potato', 'potatoes'] },
  { normalized_name: 'carrots', category: 'Vegetables', zone_key: 'produce', aliases: ['carrot', 'carrots'] },
  { normalized_name: 'broccoli', category: 'Vegetables', zone_key: 'produce', aliases: ['broccoli'] },
  // Produce gaps — bell pepper uses multi-word aliases only (not bare "pepper"; see spices below).
  { normalized_name: 'bell peppers', category: 'Vegetables', zone_key: 'produce', aliases: ['bell pepper', 'bell peppers', 'red bell pepper', 'green bell pepper'] },
  { normalized_name: 'garlic', category: 'Vegetables', zone_key: 'produce', aliases: ['garlic', 'garlic clove', 'garlic cloves'] },
  { normalized_name: 'ginger root', category: 'Vegetables', zone_key: 'produce', aliases: ['ginger root', 'fresh ginger'] },
  { normalized_name: 'lemons', category: 'Fruit', zone_key: 'produce', aliases: ['lemon', 'lemons'] },
  { normalized_name: 'limes', category: 'Fruit', zone_key: 'produce', aliases: ['lime', 'limes'] },
  { normalized_name: 'celery', category: 'Vegetables', zone_key: 'produce', aliases: ['celery'] },
  { normalized_name: 'mushrooms', category: 'Vegetables', zone_key: 'produce', aliases: ['mushroom', 'mushrooms'] },
  { normalized_name: 'cucumbers', category: 'Vegetables', zone_key: 'produce', aliases: ['cucumber', 'cucumbers'] },
  { normalized_name: 'zucchini', category: 'Vegetables', zone_key: 'produce', aliases: ['zucchini'] },
  { normalized_name: 'cilantro', category: 'Herbs', zone_key: 'produce', aliases: ['cilantro', 'fresh cilantro'] },
  { normalized_name: 'parsley', category: 'Herbs', zone_key: 'produce', aliases: ['parsley', 'fresh parsley'] },
  { normalized_name: 'basil', category: 'Herbs', zone_key: 'produce', aliases: ['basil', 'fresh basil'] },
  { normalized_name: 'dill', category: 'Herbs', zone_key: 'produce', aliases: ['dill', 'fresh dill'] },
  { normalized_name: 'mint', category: 'Herbs', zone_key: 'produce', aliases: ['mint', 'fresh mint'] },
  { normalized_name: 'chicken breasts', category: 'Meat', zone_key: 'meat_seafood', aliases: ['chicken', 'chicken breast', 'chicken breasts'] },
  { normalized_name: 'ground beef', category: 'Meat', zone_key: 'meat_seafood', aliases: ['ground beef', 'beef'] },
  { normalized_name: 'salmon', category: 'Seafood', zone_key: 'meat_seafood', aliases: ['salmon'] },
  { normalized_name: 'bacon', category: 'Meat', zone_key: 'meat_seafood', aliases: ['bacon'] },
  { normalized_name: 'ribs', category: 'Meat', zone_key: 'meat_seafood', aliases: ['ribs', 'baby back ribs', 'short ribs', 'pork ribs'] },
  { normalized_name: 'ribeye', category: 'Meat', zone_key: 'meat_seafood', aliases: ['ribeye', 'rib eye', 'rib eye steak', 'ribeye steak'] },
  { normalized_name: 'steak', category: 'Meat', zone_key: 'meat_seafood', aliases: ['steak', 'sirloin steak', 'ny strip', 'strip steak'] },
  { normalized_name: 'pork chops', category: 'Meat', zone_key: 'meat_seafood', aliases: ['pork chop', 'pork chops', 'boneless pork chops'] },
  { normalized_name: 'ground pork', category: 'Meat', zone_key: 'meat_seafood', aliases: ['ground pork'] },
  { normalized_name: 'pork tenderloin', category: 'Meat', zone_key: 'meat_seafood', aliases: ['pork tenderloin'] },
  { normalized_name: 'turkey', category: 'Meat', zone_key: 'meat_seafood', aliases: ['turkey', 'ground turkey', 'turkey breast'] },
  { normalized_name: 'sausage', category: 'Meat', zone_key: 'meat_seafood', aliases: ['sausage', 'italian sausage', 'breakfast sausage'] },
  { normalized_name: 'ham', category: 'Meat', zone_key: 'meat_seafood', aliases: ['ham', 'deli ham', 'honey ham'] },
  { normalized_name: 'shrimp', category: 'Seafood', zone_key: 'meat_seafood', aliases: ['shrimp', 'raw shrimp', 'peeled shrimp'] },
  { normalized_name: 'tilapia', category: 'Seafood', zone_key: 'meat_seafood', aliases: ['tilapia'] },
  { normalized_name: 'cod', category: 'Seafood', zone_key: 'meat_seafood', aliases: ['cod', 'cod fillet'] },
  { normalized_name: 'tuna', category: 'Seafood', zone_key: 'meat_seafood', aliases: ['tuna', 'tuna steak', 'canned tuna'] },
  { normalized_name: 'ground turkey', category: 'Meat', zone_key: 'meat_seafood', aliases: ['ground turkey'] },
  { normalized_name: 'chicken thighs', category: 'Meat', zone_key: 'meat_seafood', aliases: ['chicken thigh', 'chicken thighs', 'boneless chicken thighs'] },
  { normalized_name: 'chicken wings', category: 'Meat', zone_key: 'meat_seafood', aliases: ['chicken wings', 'wings'] },
  { normalized_name: 'ground chicken', category: 'Meat', zone_key: 'meat_seafood', aliases: ['ground chicken'] },
  { normalized_name: 'lamb chops', category: 'Meat', zone_key: 'meat_seafood', aliases: ['lamb chop', 'lamb chops'] },
  { normalized_name: 'sweet potatoes', category: 'Vegetables', zone_key: 'produce', aliases: ['sweet potato', 'sweet potatoes', 'yams'] },
  { normalized_name: 'kale', category: 'Vegetables', zone_key: 'produce', aliases: ['kale'] },
  { normalized_name: 'arugula', category: 'Vegetables', zone_key: 'produce', aliases: ['arugula'] },
  { normalized_name: 'green beans', category: 'Vegetables', zone_key: 'produce', aliases: ['green beans', 'green bean'] },
  { normalized_name: 'asparagus', category: 'Vegetables', zone_key: 'produce', aliases: ['asparagus'] },
  { normalized_name: 'corn', category: 'Vegetables', zone_key: 'produce', aliases: ['corn', 'corn on the cob'] },
  { normalized_name: 'blueberries', category: 'Fruit', zone_key: 'produce', aliases: ['blueberries', 'blueberry'] },
  { normalized_name: 'strawberries', category: 'Fruit', zone_key: 'produce', aliases: ['strawberries', 'strawberry'] },
  { normalized_name: 'grapes', category: 'Fruit', zone_key: 'produce', aliases: ['grapes', 'grape'] },
  { normalized_name: 'oranges', category: 'Fruit', zone_key: 'produce', aliases: ['orange', 'oranges'] },
  { normalized_name: 'peaches', category: 'Fruit', zone_key: 'produce', aliases: ['peach', 'peaches'] },
  { normalized_name: 'pears', category: 'Fruit', zone_key: 'produce', aliases: ['pear', 'pears'] },
  { normalized_name: 'cherries', category: 'Fruit', zone_key: 'produce', aliases: ['cherries', 'cherry'] },
  { normalized_name: 'mango', category: 'Fruit', zone_key: 'produce', aliases: ['mango', 'mangoes'] },
  { normalized_name: 'pineapple', category: 'Fruit', zone_key: 'produce', aliases: ['pineapple'] },
  { normalized_name: 'watermelon', category: 'Fruit', zone_key: 'produce', aliases: ['watermelon'] },
  { normalized_name: 'cottage cheese', category: 'Dairy', zone_key: 'dairy_eggs', aliases: ['cottage cheese'] },
  { normalized_name: 'cream cheese', category: 'Dairy', zone_key: 'dairy_eggs', aliases: ['cream cheese'] },
  { normalized_name: 'sour cream', category: 'Dairy', zone_key: 'dairy_eggs', aliases: ['sour cream'] },
  { normalized_name: 'heavy cream', category: 'Dairy', zone_key: 'dairy_eggs', aliases: ['heavy cream', 'heavy whipping cream', 'whipping cream'] },
  { normalized_name: 'half and half', category: 'Dairy', zone_key: 'dairy_eggs', aliases: ['half and half', 'half & half'] },
  { normalized_name: 'parmesan cheese', category: 'Cheese', zone_key: 'dairy_eggs', aliases: ['parmesan', 'parmesan cheese', 'grated parmesan'] },
  { normalized_name: 'feta cheese', category: 'Cheese', zone_key: 'dairy_eggs', aliases: ['feta', 'feta cheese'] },
  { normalized_name: 'bread', category: 'Bread', zone_key: 'bakery_deli', aliases: ['bread', 'sandwich bread', 'wheat bread', 'sourdough bread'] },
  { normalized_name: 'bagels', category: 'Bakery', zone_key: 'bakery_deli', aliases: ['bagel', 'bagels'] },
  { normalized_name: 'tortillas', category: 'Bakery', zone_key: 'bakery_deli', aliases: ['tortilla', 'tortillas'] },
  { normalized_name: 'rice', category: 'Pantry', zone_key: 'pantry', aliases: ['rice', 'white rice', 'brown rice'] },
  { normalized_name: 'pasta', category: 'Pantry', zone_key: 'pantry', aliases: ['pasta', 'spaghetti', 'penne'] },
  { normalized_name: 'cereal', category: 'Pantry', zone_key: 'pantry', aliases: ['cereal'] },
  { normalized_name: 'flour', category: 'Baking', zone_key: 'pantry', aliases: ['flour', 'all purpose flour'] },
  { normalized_name: 'sugar', category: 'Baking', zone_key: 'pantry', aliases: ['sugar', 'brown sugar'] },
  { normalized_name: 'olive oil', category: 'Pantry', zone_key: 'pantry', aliases: ['olive oil'] },
  { normalized_name: 'vegetable oil', category: 'Pantry', zone_key: 'pantry', aliases: ['vegetable oil', 'canola oil', 'coconut oil'] },
  // Spices — bare "pepper" means ground/black pepper, not bell pepper.
  { normalized_name: 'salt', category: 'Spices', zone_key: 'pantry', aliases: ['salt', 'kosher salt', 'sea salt', 'table salt'] },
  { normalized_name: 'black pepper', category: 'Spices', zone_key: 'pantry', aliases: ['black pepper', 'ground pepper', 'pepper'] },
  { normalized_name: 'garlic powder', category: 'Spices', zone_key: 'pantry', aliases: ['garlic powder'] },
  { normalized_name: 'onion powder', category: 'Spices', zone_key: 'pantry', aliases: ['onion powder'] },
  { normalized_name: 'paprika', category: 'Spices', zone_key: 'pantry', aliases: ['paprika'] },
  { normalized_name: 'cumin', category: 'Spices', zone_key: 'pantry', aliases: ['cumin', 'ground cumin'] },
  { normalized_name: 'cinnamon', category: 'Spices', zone_key: 'pantry', aliases: ['cinnamon', 'ground cinnamon'] },
  { normalized_name: 'chili powder', category: 'Spices', zone_key: 'pantry', aliases: ['chili powder'] },
  { normalized_name: 'oregano', category: 'Spices', zone_key: 'pantry', aliases: ['oregano', 'dried oregano'] },
  { normalized_name: 'thyme', category: 'Spices', zone_key: 'pantry', aliases: ['thyme', 'dried thyme'] },
  { normalized_name: 'rosemary', category: 'Spices', zone_key: 'pantry', aliases: ['rosemary', 'dried rosemary'] },
  { normalized_name: 'bay leaves', category: 'Spices', zone_key: 'pantry', aliases: ['bay leaf', 'bay leaves'] },
  { normalized_name: 'red pepper flakes', category: 'Spices', zone_key: 'pantry', aliases: ['red pepper flakes', 'crushed red pepper'] },
  { normalized_name: 'turmeric', category: 'Spices', zone_key: 'pantry', aliases: ['turmeric', 'ground turmeric'] },
  { normalized_name: 'nutmeg', category: 'Spices', zone_key: 'pantry', aliases: ['nutmeg', 'ground nutmeg'] },
  { normalized_name: 'ground ginger', category: 'Spices', zone_key: 'pantry', aliases: ['ground ginger', 'ginger powder'] },
  { normalized_name: 'soy sauce', category: 'Condiments', zone_key: 'pantry', aliases: ['soy sauce'] },
  { normalized_name: 'vinegar', category: 'Condiments', zone_key: 'pantry', aliases: ['vinegar', 'white vinegar', 'apple cider vinegar'] },
  { normalized_name: 'balsamic vinegar', category: 'Condiments', zone_key: 'pantry', aliases: ['balsamic vinegar', 'balsamic'] },
  { normalized_name: 'hot sauce', category: 'Condiments', zone_key: 'pantry', aliases: ['hot sauce'] },
  { normalized_name: 'ketchup', category: 'Condiments', zone_key: 'pantry', aliases: ['ketchup'] },
  { normalized_name: 'mustard', category: 'Condiments', zone_key: 'pantry', aliases: ['mustard', 'dijon mustard', 'yellow mustard'] },
  { normalized_name: 'mayonnaise', category: 'Condiments', zone_key: 'pantry', aliases: ['mayonnaise', 'mayo'] },
  { normalized_name: 'salsa', category: 'Condiments', zone_key: 'pantry', aliases: ['salsa'] },
  { normalized_name: 'worcestershire sauce', category: 'Condiments', zone_key: 'pantry', aliases: ['worcestershire sauce', 'worcestershire'] },
  { normalized_name: 'fish sauce', category: 'Condiments', zone_key: 'pantry', aliases: ['fish sauce'] },
  { normalized_name: 'canned tomatoes', category: 'Canned', zone_key: 'pantry', aliases: ['canned tomatoes', 'diced tomatoes', 'crushed tomatoes'] },
  { normalized_name: 'tomato paste', category: 'Canned', zone_key: 'pantry', aliases: ['tomato paste'] },
  { normalized_name: 'chicken broth', category: 'Canned', zone_key: 'pantry', aliases: ['chicken broth', 'chicken stock'] },
  { normalized_name: 'vegetable broth', category: 'Canned', zone_key: 'pantry', aliases: ['vegetable broth', 'vegetable stock'] },
  { normalized_name: 'black beans', category: 'Canned', zone_key: 'pantry', aliases: ['black beans', 'canned black beans'] },
  { normalized_name: 'kidney beans', category: 'Canned', zone_key: 'pantry', aliases: ['kidney beans', 'canned kidney beans'] },
  { normalized_name: 'chickpeas', category: 'Canned', zone_key: 'pantry', aliases: ['chickpeas', 'garbanzo beans', 'canned chickpeas'] },
  { normalized_name: 'coconut milk', category: 'Canned', zone_key: 'pantry', aliases: ['coconut milk', 'canned coconut milk'] },
  { normalized_name: 'baking powder', category: 'Baking', zone_key: 'pantry', aliases: ['baking powder'] },
  { normalized_name: 'baking soda', category: 'Baking', zone_key: 'pantry', aliases: ['baking soda'] },
  { normalized_name: 'vanilla extract', category: 'Baking', zone_key: 'pantry', aliases: ['vanilla extract', 'vanilla'] },
  { normalized_name: 'yeast', category: 'Baking', zone_key: 'pantry', aliases: ['yeast', 'active dry yeast'] },
  { normalized_name: 'cocoa powder', category: 'Baking', zone_key: 'pantry', aliases: ['cocoa powder', 'unsweetened cocoa'] },
  { normalized_name: 'chocolate chips', category: 'Baking', zone_key: 'pantry', aliases: ['chocolate chips'] },
  { normalized_name: 'coffee', category: 'Pantry', zone_key: 'pantry', aliases: ['coffee', 'coffee beans'] },
  { normalized_name: 'peanut butter', category: 'Pantry', zone_key: 'pantry', aliases: ['peanut butter'] },
  { normalized_name: 'chips', category: 'Snacks', zone_key: 'snacks_drinks', aliases: ['chips', 'potato chips', 'tortilla chips'] },
  { normalized_name: 'crackers', category: 'Snacks', zone_key: 'snacks_drinks', aliases: ['cracker', 'crackers'] },
  { normalized_name: 'sparkling water', category: 'Drinks', zone_key: 'snacks_drinks', aliases: ['sparkling water', 'seltzer', 'water'] },
  { normalized_name: 'orange juice', category: 'Drinks', zone_key: 'snacks_drinks', aliases: ['orange juice', 'juice'] },
  { normalized_name: 'ice cream', category: 'Frozen', zone_key: 'frozen', aliases: ['ice cream'] },
  { normalized_name: 'frozen pizza', category: 'Frozen', zone_key: 'frozen', aliases: ['frozen pizza', 'pizza'] },
  { normalized_name: 'frozen vegetables', category: 'Frozen', zone_key: 'frozen', aliases: ['frozen vegetables', 'frozen veggies'] },
  { normalized_name: 'dish soap', category: 'Cleaning', zone_key: 'household_cleaning', aliases: ['dish soap', 'dishwashing soap'] },
  { normalized_name: 'laundry detergent', category: 'Cleaning', zone_key: 'household_cleaning', aliases: ['laundry detergent', 'detergent'] },
  { normalized_name: 'paper towels', category: 'Household', zone_key: 'household_cleaning', aliases: ['paper towel', 'paper towels'] },
  { normalized_name: 'toilet paper', category: 'Household', zone_key: 'household_cleaning', aliases: ['toilet paper', 'tp'] },
  { normalized_name: 'toothpaste', category: 'Personal Care', zone_key: 'personal_care', aliases: ['toothpaste'] },
  { normalized_name: 'shampoo', category: 'Personal Care', zone_key: 'personal_care', aliases: ['shampoo'] },
  { normalized_name: 'soap', category: 'Personal Care', zone_key: 'personal_care', aliases: ['soap', 'body wash'] },
];

export type GroceryCategoryEntry = {
  normalized_name: string;
  zone_key: string;
  category: string;
};

export type FastCategoryResult = GroceryCategoryEntry & {
  confidence: number;
  source: 'catalog_exact' | 'catalog_partial' | 'catalog_fuzzy' | 'cache_partial' | 'cache_fuzzy';
};

const DESCRIPTOR_WORDS = new Set([
  'a',
  'an',
  'and',
  'bag',
  'bunch',
  'bulk',
  'can',
  'cans',
  'container',
  'containers',
  'ct',
  'fresh',
  'large',
  'medium',
  'organic',
  'pack',
  'packs',
  'pkg',
  'ripe',
  'small',
  'the',
  'whole',
]);

const UNIT_WORDS = new Set([
  'bottle',
  'bottles',
  'box',
  'boxes',
  'cup',
  'cups',
  'dozen',
  'ea',
  'each',
  'gal',
  'gallon',
  'gallons',
  'gram',
  'grams',
  'jar',
  'jars',
  'kg',
  'lb',
  'lbs',
  'liter',
  'liters',
  'l',
  'ml',
  'oz',
  'ounce',
  'ounces',
  'pint',
  'pints',
  'qt',
  'quart',
  'quarts',
  'tbsp',
  'tsp',
]);

function baseNormalize(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

function singularize(token: string): string {
  if (token.endsWith('ies') && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith('oes') && token.length > 4) return token.slice(0, -2);
  if (token.endsWith('s') && !token.endsWith('ss') && token.length > 3) return token.slice(0, -1);
  return token;
}

function tokenize(input: string): string[] {
  return baseNormalize(input)
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !/^\d+([./]\d+)?$/.test(token))
    .filter((token) => !UNIT_WORDS.has(token))
    .filter((token) => !DESCRIPTOR_WORDS.has(token))
    .map(singularize);
}

function keyFor(input: string): string {
  return tokenize(input).join(' ');
}

export function canonicalGroceryKey(input: string): string {
  return keyFor(input);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const cur = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}

function maxEditDistance(length: number): number {
  if (length < 5) return 0;
  if (length <= 8) return 1;
  return 2;
}

function isContained(candidateTokens: string[], aliasTokens: string[]): boolean {
  if (candidateTokens.length === 0 || aliasTokens.length === 0) return false;
  if (candidateTokens.length < aliasTokens.length) return false;
  return aliasTokens.every((token) => candidateTokens.includes(token));
}

function resolveAgainstEntries(
  input: string,
  entries: GroceryCategoryEntry[],
  source: 'cache' | 'catalog'
): FastCategoryResult | null {
  const candidateKey = keyFor(input);
  if (!candidateKey) return null;
  const candidateTokens = candidateKey.split(' ');

  for (const entry of entries) {
    const aliasKey = keyFor(entry.normalized_name);
    if (candidateKey === aliasKey) {
      return {
        ...entry,
        confidence: source === 'catalog' ? 0.98 : 0.96,
        source: source === 'catalog' ? 'catalog_exact' : 'cache_partial',
      };
    }
  }

  for (const entry of entries) {
    const aliasTokens = keyFor(entry.normalized_name).split(' ').filter(Boolean);
    if (isContained(candidateTokens, aliasTokens) && candidateTokens.length <= aliasTokens.length + 2) {
      return {
        ...entry,
        confidence: source === 'catalog' ? 0.9 : 0.88,
        source: source === 'catalog' ? 'catalog_partial' : 'cache_partial',
      };
    }
  }

  for (const entry of entries) {
    const aliasKey = keyFor(entry.normalized_name);
    if (!aliasKey || Math.abs(aliasKey.length - candidateKey.length) > 2) continue;
    const distance = levenshtein(candidateKey, aliasKey);
    if (distance > 0 && distance <= maxEditDistance(Math.max(candidateKey.length, aliasKey.length))) {
      return {
        ...entry,
        confidence: source === 'catalog' ? 0.84 : 0.82,
        source: source === 'catalog' ? 'catalog_fuzzy' : 'cache_fuzzy',
      };
    }
  }

  return null;
}

const CATALOG_ALIAS_ENTRIES: GroceryCategoryEntry[] = COMMON_GROCERY_CATALOG.flatMap((entry: CommonGroceryCatalogEntry) =>
  Array.from(new Set([entry.normalized_name, ...entry.aliases])).map((alias) => ({
    normalized_name: alias,
    category: entry.category,
    zone_key: entry.zone_key,
  }))
);

export function resolveCommonGroceryCategoryCore(input: string): FastCategoryResult | null {
  const match = resolveAgainstEntries(input, CATALOG_ALIAS_ENTRIES, 'catalog');
  if (!match) return null;
  const canonical = COMMON_GROCERY_CATALOG.find((entry) =>
    [entry.normalized_name, ...entry.aliases].some((alias) => keyFor(alias) === keyFor(match.normalized_name))
  );
  return {
    normalized_name: canonical?.normalized_name ?? match.normalized_name,
    category: canonical?.category ?? match.category,
    zone_key: canonical?.zone_key ?? match.zone_key,
    confidence: match.confidence,
    source: match.source,
  };
}

export function resolveFromCategoryEntriesCore(
  input: string,
  entries: GroceryCategoryEntry[]
): FastCategoryResult | null {
  return resolveAgainstEntries(input, entries, 'cache');
}

export function tokensForFuzzyCacheLookup(cacheMissInputs: string[], maxTokens = 12): string[] {
  const seen = new Set<string>();
  for (const input of cacheMissInputs) {
    const key = keyFor(input);
    for (const t of key.split(' ')) {
      if (t.length >= 3) seen.add(t);
    }
  }
  return Array.from(seen).slice(0, maxTokens);
}

export type CatalogSuggestion = {
  display_name: string;
  normalized_name: string;
  source: 'catalog';
};

function titleCasePhrase(phrase: string): string {
  return phrase
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const CATALOG_SUGGESTION_INDEX: CatalogSuggestion[] = (() => {
  const seen = new Set<string>();
  const rows: CatalogSuggestion[] = [];
  for (const entry of COMMON_GROCERY_CATALOG) {
    const canonicalKey = keyFor(entry.normalized_name) || entry.normalized_name;
    const canonicalSlug = entry.normalized_name;
    const display = titleCasePhrase(entry.normalized_name);
    for (const alias of new Set([entry.normalized_name, ...entry.aliases])) {
      const aliasKey = keyFor(alias);
      if (!aliasKey || seen.has(aliasKey)) continue;
      seen.add(aliasKey);
      rows.push({
        display_name: titleCasePhrase(alias),
        normalized_name: canonicalSlug,
        source: 'catalog',
      });
    }
    if (canonicalKey && !seen.has(canonicalKey)) {
      seen.add(canonicalKey);
      rows.push({
        display_name: display,
        normalized_name: canonicalSlug,
        source: 'catalog',
      });
    }
  }
  return rows;
})();

function anyWordStartsWith(text: string, query: string): boolean {
  return text.split(/\s+/).filter(Boolean).some((word) => word.startsWith(query));
}

function fuzzySuggestionDistance(candidate: string, query: string): number | null {
  if (!candidate || query.length < 4) return null;
  if (Math.abs(candidate.length - query.length) > 2) return null;
  const distance = levenshtein(candidate, query);
  const maxDist = maxEditDistance(Math.max(candidate.length, query.length));
  if (distance > 0 && distance <= maxDist) return distance;
  return null;
}

/**
 * Score a quick-add suggestion match. Lower tier = better. `null` = no match.
 * Tier 0: display or key starts with query
 * Tier 1: any word in display/key starts with query
 * Tier 2: fuzzy Levenshtein when query length >= 4
 * Tier 3: substring includes (query length >= 4 only)
 */
export function scoreSuggestionMatch(displayLower: string, key: string, query: string): number | null {
  if (!query) return null;
  if (displayLower.startsWith(query) || key.startsWith(query)) return 0;
  if (anyWordStartsWith(displayLower, query) || anyWordStartsWith(key, query)) return 1;
  if (query.length >= 4) {
    const fuzzyCandidates = [key, displayLower.replace(/\s+/g, '')];
    for (const candidate of fuzzyCandidates) {
      if (fuzzySuggestionDistance(candidate, query) != null) return 2;
    }
    if (displayLower.includes(query) || key.includes(query)) return 3;
  }
  return null;
}

/** Prefix/substring search over curated catalog aliases (no network). */
export function searchCatalogSuggestions(prefix: string, limit = 8): CatalogSuggestion[] {
  const query = prefix.trim().toLowerCase();
  if (!query) return [];

  const scored: { row: CatalogSuggestion; tier: number }[] = [];
  for (const row of CATALOG_SUGGESTION_INDEX) {
    const key = row.normalized_name;
    const displayLower = row.display_name.toLowerCase();
    const tier = scoreSuggestionMatch(displayLower, key, query);
    if (tier === null) continue;
    scored.push({ row, tier });
  }

  scored.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return a.row.display_name.localeCompare(b.row.display_name);
  });

  const deduped: CatalogSuggestion[] = [];
  const seen = new Set<string>();
  for (const { row } of scored) {
    if (seen.has(row.normalized_name)) continue;
    seen.add(row.normalized_name);
    deduped.push(row);
    if (deduped.length >= limit) break;
  }
  return deduped;
}
