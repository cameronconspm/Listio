import { mapDbErrorToUserMessage } from '../src/utils/mapDbError';

describe('mapDbErrorToUserMessage', () => {
  it('maps RLS failures to a sign-in prompt', () => {
    expect(
      mapDbErrorToUserMessage(
        { message: 'new row violates row-level security policy', code: '42501' },
        'Could not add items.'
      )
    ).toBe('Sign in again to continue.');
  });

  it('maps expired JWT errors to a sign-in prompt', () => {
    expect(
      mapDbErrorToUserMessage({ message: 'JWT expired', code: 'PGRST301' }, 'Could not add items.')
    ).toBe('Sign in again to continue.');
  });
});
