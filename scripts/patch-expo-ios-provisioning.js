#!/usr/bin/env node
/**
 * Ensures `expo run:ios --device` passes -allowProvisioningUpdates when the Xcode
 * project already has DEVELOPMENT_TEAM set (Expo otherwise skips profile refresh).
 *
 * Needed after adding App Groups / Sign in with Apple entitlements.
 * See docs/IOS_DEVICE_BUILD.md
 */
const path = require('path');
const fs = require('fs');

const targetPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo',
  'node_modules',
  '@expo/cli',
  'build',
  'src',
  'run',
  'ios',
  'XcodeBuild.js'
);

const PATCH_MARKER =
  'Physical device builds need them after entitlements change (App Groups, Sign in with Apple).';

if (!fs.existsSync(targetPath)) {
  console.warn('scripts/patch-expo-ios-provisioning.js: @expo/cli not found, skipping.');
  process.exit(0);
}

let content = fs.readFileSync(targetPath, 'utf8');

if (content.includes(PATCH_MARKER)) {
  process.exit(0);
}

const search = `        if (developmentTeamId) {
            args.push(\`DEVELOPMENT_TEAM=\${developmentTeamId}\`, '-allowProvisioningUpdates', '-allowProvisioningDeviceRegistration');
        }
    }
    // Add last`;

const replace = `        if (developmentTeamId) {
            args.push(\`DEVELOPMENT_TEAM=\${developmentTeamId}\`, '-allowProvisioningUpdates', '-allowProvisioningDeviceRegistration');
        }
    }
    // When DEVELOPMENT_TEAM is already in the pbxproj, Expo skips provisioning refresh flags.
    // Physical device builds need them after entitlements change (App Groups, Sign in with Apple).
    if (!props.isSimulator && !args.includes('-allowProvisioningUpdates')) {
        args.push('-allowProvisioningUpdates', '-allowProvisioningDeviceRegistration');
    }
    // Add last`;

if (!content.includes(search)) {
  console.warn(
    'scripts/patch-expo-ios-provisioning.js: Could not find expected code to patch. Expo may have updated.'
  );
  process.exit(0);
}

content = content.replace(search, replace);
fs.writeFileSync(targetPath, content);
console.log('scripts/patch-expo-ios-provisioning.js: Patched @expo/cli for device provisioning refresh.');
