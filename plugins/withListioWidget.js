const { withEntitlementsPlist, withInfoPlist, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const APP_GROUP = 'group.com.cameroncons.listio';

/**
 * Adds App Group entitlement for widget data sharing and documents Siri URL scheme.
 */
function withListioWidget(config) {
  config = withEntitlementsPlist(config, (cfg) => {
    const entitlements = cfg.modResults;
    const groups = entitlements['com.apple.security.application-groups'] ?? [];
    if (!groups.includes(APP_GROUP)) {
      entitlements['com.apple.security.application-groups'] = [...groups, APP_GROUP];
    }
    return cfg;
  });

  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.LSApplicationQueriesSchemes = [
      ...(cfg.modResults.LSApplicationQueriesSchemes ?? []),
      'shortcuts',
    ];
    return cfg;
  });

  // Local Xcode builds lack SENTRY_ORG/PROJECT/AUTH_TOKEN; match eas.json production behavior.
  config = withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const envPath = path.join(cfg.modRequest.platformProjectRoot, '.xcode.env');
      if (!fs.existsSync(envPath)) return cfg;
      let content = fs.readFileSync(envPath, 'utf8');
      if (!content.includes('SENTRY_DISABLE_AUTO_UPLOAD')) {
        content = `${content.trimEnd()}\n\n# Skip sentry-cli source map upload on local builds (see docs/ENV_AND_SECRETS.md)\nexport SENTRY_DISABLE_AUTO_UPLOAD=true\n`;
        fs.writeFileSync(envPath, content);
      }
      return cfg;
    },
  ]);

  return config;
}

module.exports = withListioWidget;
