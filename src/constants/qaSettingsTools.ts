import { isOfficialListioTestAccount } from './officialTestAccount';

/**
 * When set at build time (EAS env / .env), shows the Profile settings Demo section and “Replay onboarding”
 * for any signed-in user — for TestFlight / internal QA without relying on the official test email alone.
 * Do not enable on App Store production builds.
 */
export function isQaSettingsToolsEnabledViaEnv(): boolean {
  const v = process.env.EXPO_PUBLIC_ENABLE_QA_SETTINGS_TOOLS;
  if (typeof v !== 'string') return false;
  const t = v.trim().toLowerCase();
  return t === '1' || t === 'true' || t === 'yes';
}

export function shouldShowQaSettingsTools(accountEmail: string | null): boolean {
  return isOfficialListioTestAccount(accountEmail) || isQaSettingsToolsEnabledViaEnv();
}
