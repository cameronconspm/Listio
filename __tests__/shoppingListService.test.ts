jest.mock('../src/services/supabaseClient', () => ({
  supabase: {
    from: jest.fn(),
  },
  isSyncEnabled: jest.fn(() => true),
}));

jest.mock('../src/services/syncInsertScope', () => ({
  resolveDataScopeId: jest.fn(async () => 'scope-1'),
}));

jest.mock('../src/services/userPreferencesService', () => ({
  fetchUserPreferences: jest.fn(async () => ({})),
  patchUserPreferencesIfSync: jest.fn(async () => undefined),
}));

/* eslint-disable import/first -- jest.mock is hoisted */
import { supabase } from '../src/services/supabaseClient';
import {
  deleteShoppingList,
  invalidateDefaultListIdCache,
  renameShoppingList,
  resolveDefaultListId,
} from '../src/services/shoppingListService';

const mockFrom = supabase.from as jest.Mock;

type MockChain = {
  select: jest.Mock;
  eq: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
  maybeSingle: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
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
    update: jest.fn(() => api),
    delete: jest.fn(() => api),
    single: jest.fn(async () => result),
  };
  return Object.assign(api, {
    then: (
      onFulfilled?: ((value: { data: unknown; error: unknown }) => unknown) | null,
      onRejected?: ((reason: unknown) => unknown) | null
    ) => Promise.resolve(result).then(onFulfilled ?? undefined, onRejected ?? undefined),
  }) as MockChain;
}

describe('shoppingListService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    invalidateDefaultListIdCache(null);
  });

  it('returns the default shopping list id for the user', async () => {
    mockFrom.mockReturnValue(chain({ data: { id: 'list-default' }, error: null }));

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

  it('renames a shopping list', async () => {
    const updateChain = chain({
      data: {
        id: 'list-2',
        household_id: 'scope-1',
        name: 'Costco',
        is_default: false,
        sort_order: 1,
      },
      error: null,
    });
    mockFrom.mockReturnValue(updateChain);

    await expect(renameShoppingList('list-2', '  Costco  ')).resolves.toMatchObject({
      id: 'list-2',
      name: 'Costco',
    });
    expect(updateChain.update).toHaveBeenCalledWith({ name: 'Costco' });
  });

  it('rejects deleting the default list', async () => {
    const fetchChain = chain({
      data: [
        { id: 'list-1', is_default: true, name: 'Groceries', sort_order: 0 },
        { id: 'list-2', is_default: false, name: 'Party', sort_order: 1 },
      ],
      error: null,
    });
    mockFrom.mockReturnValue(fetchChain);

    await expect(deleteShoppingList('list-1')).rejects.toThrow('main list cannot be deleted');
  });

  it('deletes a non-default list when another list remains', async () => {
    const fetchChain = chain({
      data: [
        { id: 'list-1', is_default: true, name: 'Groceries', sort_order: 0 },
        { id: 'list-2', is_default: false, name: 'Party', sort_order: 1 },
      ],
      error: null,
    });
    const deleteChain = chain({ data: null, error: null });
    mockFrom.mockReturnValueOnce(fetchChain).mockReturnValueOnce(deleteChain);

    await expect(deleteShoppingList('list-2')).resolves.toBeUndefined();
    expect(deleteChain.delete).toHaveBeenCalled();
  });
});
