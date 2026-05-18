jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  wrap: (c: unknown) => c,
  withScope: (fn: (scope: { setExtra: jest.Mock }) => void) =>
    fn({ setExtra: jest.fn() }),
  captureException: jest.fn(),
}));

describe('sentryService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  it('isSentryConfigured is false without DSN', () => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { isSentryConfigured } = require('../src/services/sentryService') as typeof import('../src/services/sentryService');
    expect(isSentryConfigured()).toBe(false);
  });

  it('isSentryConfigured is true when DSN is set', () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://example@o0.ingest.sentry.io/0';
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { isSentryConfigured } = require('../src/services/sentryService') as typeof import('../src/services/sentryService');
    expect(isSentryConfigured()).toBe(true);
  });

  it('initSentry and captureException no-op without DSN', () => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { initSentry, captureException } = require('../src/services/sentryService') as typeof import('../src/services/sentryService');
    expect(() => {
      initSentry();
      captureException(new Error('test'));
    }).not.toThrow();
  });
});
