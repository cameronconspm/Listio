jest.mock('../src/services/supabaseClient', () => ({
  supabase: {
    from: jest.fn(),
  },
  isSyncEnabled: jest.fn(() => true),
}));

jest.mock('../src/services/syncInsertScope', () => ({
  resolveDataScopeId: jest.fn(async () => 'scope-1'),
}));

import { supabase } from '../src/services/supabaseClient';
import { invalidateDefaultListIdCache, resolveDefaultListId } from '../src/services/shoppingListService';

const mockFrom = supabase.from as jest.Mock;

type MockChain = {
  select: jest.Mock;
  eq: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
  maybeSingle: jest.Mock;
  insert: jest.Mock;
  single: jest.Mock;
};

function chain(result: { data: unknown; error: unknown }): MockChain {
  const api: MockChain = {
    select: jest.fn(() => api),
    eq: jest.fn(() => api),
    order: jest.fn(() => api),
    limit: jest.fn(() => api),
    maybeSingle: jest.fn(async () => result),
    insert: jest.fn(() => api),
    single: jest.fn(async () => result),
  };
  return api;
}

describe('shoppingListService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    invalidateDefaultListIdCache(null);
  });

  it('returns the default shopping list id for the user', async () => {
    mockFrom.mockReturnValue(
      chain({ data: { id: 'list-default' }, error: null })
    );

    await expect(resolveDefaultListId()).resolves.toBe('list-default');
    expect(mockFrom).toHaveBeenCalledWith('shopping_lists');
  });

  it('creates a default list when none exists', async () => {
    const defaultChain = chain({ data: null, error: null });
    const anyChain = chain({ data: null, error: null });
    const createChain = chain({ data: { id: 'list-new' }, error: null });

    mockFrom
      .mockReturnValueOnce(defaultChain)
      .mockReturnValueOnce(anyChain)
      .mockReturnValueOnce(createChain);

    await expect(resolveDefaultListId()).resolves.toBe('list-new');
    expect(createChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        household_id: 'scope-1',
        name: 'Groceries',
        is_default: true,
      })
    );
  });
});
