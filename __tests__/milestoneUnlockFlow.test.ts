import {
  processListItemsMilestone,
  processMealSavedMilestone,
  processRecipeSavedMilestone,
} from '../src/firstLaunchTour/milestoneUnlockFlow';
import { resetMilestoneUnlockStateForTests } from '../src/firstLaunchTour/milestoneUnlockStore';
import type { ListItem } from '../src/types/models';

jest.mock('../src/utils/appToast', () => ({
  showSuccess: jest.fn(),
  showInfo: jest.fn(),
  showError: jest.fn(),
}));

jest.mock('../src/hooks/useHaptics', () => {
  const handle = { success: jest.fn(), light: jest.fn(), selection: jest.fn() };
  return { appHaptics: handle, useHaptics: () => handle };
});

const { showSuccess } = jest.requireMock('../src/utils/appToast');
const { appHaptics } = jest.requireMock('../src/hooks/useHaptics');

function listOf(n: number): ListItem[] {
  return Array.from({ length: n }, (_, i) => ({ id: `uuid-${i}` })) as unknown as ListItem[];
}

beforeEach(async () => {
  jest.clearAllMocks();
  await resetMilestoneUnlockStateForTests();
});

describe('milestone celebrations (un-gated rewards)', () => {
  it('celebrates the list milestone once at 3 persisted items', async () => {
    await processListItemsMilestone(listOf(2));
    expect(showSuccess).not.toHaveBeenCalled();

    await processListItemsMilestone(listOf(3));
    expect(appHaptics.success).toHaveBeenCalledTimes(1);
    expect(showSuccess).toHaveBeenCalledTimes(1);
    expect(showSuccess.mock.calls[0][1]).toMatch(/taking shape/i);

    await processListItemsMilestone(listOf(5));
    expect(showSuccess).toHaveBeenCalledTimes(1);
  });

  it('ignores pending (in-flight) rows when counting list items', async () => {
    const withPending = [
      { id: 'uuid-1' },
      { id: 'uuid-2' },
      { id: 'pending:abc' },
    ] as unknown as ListItem[];
    await processListItemsMilestone(withPending);
    expect(showSuccess).not.toHaveBeenCalled();
  });

  it('celebrates the first meal and first recipe once each', async () => {
    await processMealSavedMilestone();
    await processMealSavedMilestone();
    expect(showSuccess).toHaveBeenCalledTimes(1);
    expect(showSuccess.mock.calls[0][1]).toMatch(/meal planned/i);

    await processRecipeSavedMilestone();
    expect(showSuccess).toHaveBeenCalledTimes(2);
    expect(showSuccess.mock.calls[1][1]).toMatch(/recipe saved/i);
  });

  it('shows the graduation moment (not the per-milestone toast) when the set completes', async () => {
    await processListItemsMilestone(listOf(3));
    await processMealSavedMilestone();
    showSuccess.mockClear();
    appHaptics.success.mockClear();

    // The recipe is the third and final milestone — this should graduate.
    await processRecipeSavedMilestone();
    expect(showSuccess).toHaveBeenCalledTimes(1);
    expect(showSuccess.mock.calls[0][1]).toMatch(/hang of Listio/i);

    // No further celebrations once graduated.
    await processRecipeSavedMilestone();
    expect(showSuccess).toHaveBeenCalledTimes(1);
  });
});
