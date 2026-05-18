import { ServiceFetchError, throwOnSupabaseFetchError } from '../src/utils/serviceErrors';

describe('serviceErrors', () => {
  it('throwOnSupabaseFetchError throws ServiceFetchError with mapped message', () => {
    expect(() =>
      throwOnSupabaseFetchError(
        { message: 'db down', code: 'PGRST', details: '', hint: '', name: 'PostgrestError' },
        'Could not load your list.'
      )
    ).toThrow(ServiceFetchError);
    try {
      throwOnSupabaseFetchError(
        { message: 'db down', code: 'PGRST', details: '', hint: '', name: 'PostgrestError' },
        'Could not load your list.'
      );
    } catch (e) {
      expect(e).toBeInstanceOf(ServiceFetchError);
      expect((e as ServiceFetchError).message).toBeTruthy();
    }
  });

  it('throwOnSupabaseFetchError no-ops when error is null', () => {
    expect(() => throwOnSupabaseFetchError(null, 'fallback')).not.toThrow();
  });
});
