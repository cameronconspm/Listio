import { householdMemberDisplayName } from '../src/utils/householdMemberDisplay';

describe('householdMemberDisplayName', () => {
  it('prefers full name', () => {
    expect(
      householdMemberDisplayName({
        full_name: 'Alex Kim',
        email: 'alex@example.com',
        role: 'owner',
      })
    ).toBe('Alex Kim');
  });

  it('falls back to email when name is empty', () => {
    expect(
      householdMemberDisplayName({
        full_name: '  ',
        email: 'partner@example.com',
        role: 'member',
      })
    ).toBe('partner@example.com');
  });

  it('falls back to role label when name and email are missing', () => {
    expect(
      householdMemberDisplayName({
        full_name: null,
        email: null,
        role: 'member',
      })
    ).toBe('Member');
  });
});
