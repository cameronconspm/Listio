import type { AuthError } from '@supabase/supabase-js';
import {
  installSupabaseBenignAuthErrorConsoleFilter,
  isCorruptSupabaseRefreshTokenError,
} from '../src/services/supabaseClient';

/** Cast a plain error-shape object to AuthError for test mocking. */
function mockAuthError(shape: Partial<AuthError>): AuthError {
  return shape as unknown as AuthError;
}

describe('isCorruptSupabaseRefreshTokenError', () => {
  it('detects refresh_token_not_found by code', () => {
    expect(
      isCorruptSupabaseRefreshTokenError(mockAuthError({
        name: 'AuthApiError',
        message: 'Invalid Refresh Token: Refresh Token Not Found',
        status: 400,
        code: 'refresh_token_not_found',
      }))
    ).toBe(true);
  });

  it('detects refresh_token_already_used by code', () => {
    expect(
      isCorruptSupabaseRefreshTokenError(mockAuthError({
        name: 'AuthApiError',
        message: 'Invalid Refresh Token: Already Used',
        status: 400,
        code: 'refresh_token_already_used',
      }))
    ).toBe(true);
  });

  it('detects invalid refresh token by message', () => {
    expect(
      isCorruptSupabaseRefreshTokenError(mockAuthError({
        name: 'AuthApiError',
        message: 'Invalid Refresh Token: Refresh Token Not Found',
        status: 400,
      }))
    ).toBe(true);
  });

  it('ignores unrelated auth errors', () => {
    expect(
      isCorruptSupabaseRefreshTokenError(mockAuthError({
        name: 'AuthApiError',
        message: 'Invalid login credentials',
        status: 400,
        code: 'invalid_credentials',
      }))
    ).toBe(false);
  });
});

describe('installSupabaseBenignAuthErrorConsoleFilter', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('suppresses handled corrupt refresh token console.error logs', () => {
    const original = jest.spyOn(console, 'error').mockImplementation(() => {});
    installSupabaseBenignAuthErrorConsoleFilter();

    console.error({
      name: 'AuthApiError',
      message: 'Invalid Refresh Token: Refresh Token Not Found',
      code: 'refresh_token_not_found',
    });
    console.error('Something else broke');

    expect(original).toHaveBeenCalledTimes(1);
    expect(original).toHaveBeenCalledWith('Something else broke');
  });
});
