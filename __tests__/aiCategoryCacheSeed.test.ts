import {
  __resetCategoryCacheForTests,
  getCachedCategorySync,
  hydrateCategoryCache,
  seedCategoryCacheFromListItems,
} from '../src/services/aiCategoryCache';

describe('seedCategoryCacheFromListItems', () => {
  beforeEach(() => {
    __resetCategoryCacheForTests();
  });

  it('warms cache from list rows and skips other zone', async () => {
    await hydrateCategoryCache();
    seedCategoryCacheFromListItems([
      {
        normalized_name: 'garlic powder',
        zone_key: 'pantry',
        category: 'Spices',
      },
      {
        normalized_name: 'mystery item',
        zone_key: 'other',
        category: 'other',
      },
    ]);

    expect(getCachedCategorySync('garlic powder')).toMatchObject({
      zone_key: 'pantry',
      category: 'Spices',
    });
    expect(getCachedCategorySync('mystery item')).toBeNull();
  });
});
