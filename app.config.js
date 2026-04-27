// Static fields live in app.json; this file uses the (request) => config form so Expo merges app.json
// and expo-doctor detects that static config is used.
const fs = require('fs');
const path = require('path');

/** Read .env into process.env so EXPO_PUBLIC_* is available here and in expo.extra (Metro may omit inline env in some setups). */
function loadEnvFile() {
  const projectRoot = path.dirname(require.resolve('./package.json'));
  const envPath = path.join(projectRoot, '.env');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

/**
 * @param {{ config: Record<string, unknown> }} request
 */
module.exports = (request) => {
  loadEnvFile();

  const expo = request.config;

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  /** Public RevenueCat SDK key (iOS) from Project settings → API keys — safe to ship in the client. */
  const revenueCatIosApiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? '';
  const baseExtra = (expo.extra && typeof expo.extra === 'object' ? expo.extra : {}) ?? {};
  const baseEas =
    (baseExtra.eas && typeof baseExtra.eas === 'object' ? baseExtra.eas : {}) ?? {};
  const easProjectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID || baseEas.projectId || undefined;

  expo.extra = {
    ...baseExtra,
    supabaseUrl,
    supabaseAnonKey,
    revenueCatIosApiKey,
    eas: {
      ...baseEas,
      ...(easProjectId ? { projectId: easProjectId } : {}),
    },
  };

  return expo;
};
