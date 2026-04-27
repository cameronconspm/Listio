const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');
const xcode = require('xcode');

const STOREKIT_FILENAME = 'Listio.storekit';
const STOREKIT_RELATIVE = `Listio/${STOREKIT_FILENAME}`;

/**
 * PBXGroup for the iOS app target (Expo also creates a nested "Listio" group for generated Swift).
 */
function getAppSourceGroupKey(project) {
  const groups = project.hash.project.objects.PBXGroup;
  for (const key of Object.keys(groups)) {
    if (key.endsWith('_comment')) continue;
    const group = groups[key];
    if (!group || group.isa !== 'PBXGroup' || !Array.isArray(group.children)) continue;
    for (const child of group.children) {
      const comment = child && typeof child === 'object' ? child.comment : '';
      if (comment === 'AppDelegate.swift') return key;
    }
  }
  return null;
}

/**
 * Copies repo `storekit/Listio.storekit` into the native project, adds an Xcode file reference, and wires the
 * StoreKit configuration into shared schemes so Simulator IAP works with the same subscription gate as on device.
 */
function withListioStorekit(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const iosRoot = path.join(projectRoot, 'ios');
      if (!fs.existsSync(iosRoot)) return cfg;

      const src = path.join(projectRoot, 'storekit', STOREKIT_FILENAME);
      if (!fs.existsSync(src)) {
        throw new Error(
          `withListioStorekit: missing ${path.relative(projectRoot, src)} — keep it in the repo for prebuild.`
        );
      }

      const destDir = path.join(iosRoot, 'Listio');
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(src, path.join(destDir, STOREKIT_FILENAME));

      const xcodeprojNames = fs.readdirSync(iosRoot).filter((n) => n.endsWith('.xcodeproj'));
      if (xcodeprojNames.length === 0) return cfg;

      const pbxPath = path.join(iosRoot, xcodeprojNames[0], 'project.pbxproj');
      if (!fs.existsSync(pbxPath)) return cfg;

      const proj = xcode.project(pbxPath);
      proj.parseSync();

      if (!proj.hasFile(STOREKIT_RELATIVE)) {
        const groupKey = getAppSourceGroupKey(proj);
        if (!groupKey) {
          throw new Error('withListioStorekit: could not find app PBXGroup (AppDelegate.swift).');
        }
        const added = proj.addFile(STOREKIT_RELATIVE, groupKey);
        if (!added) {
          throw new Error(`withListioStorekit: failed to add ${STOREKIT_RELATIVE} to Xcode project.`);
        }
      }

      fs.writeFileSync(pbxPath, proj.writeSync());

      const schemesDir = path.join(iosRoot, xcodeprojNames[0], 'xcshareddata', 'xcschemes');
      if (!fs.existsSync(schemesDir)) return cfg;

      const storeKitBlock = `\n      <StoreKitConfigurationFileReference\n         identifier = "../Listio/${STOREKIT_FILENAME}">\n      </StoreKitConfigurationFileReference>`;

      for (const schemeName of fs.readdirSync(schemesDir)) {
        if (!schemeName.endsWith('.xcscheme')) continue;
        const schemePath = path.join(schemesDir, schemeName);
        let xml = fs.readFileSync(schemePath, 'utf8');
        if (xml.includes('StoreKitConfigurationFileReference')) continue;

        const launchOpen = xml.indexOf('<LaunchAction');
        if (launchOpen === -1) continue;
        const launchClose = xml.indexOf('</LaunchAction>', launchOpen);
        if (launchClose === -1) continue;

        const launchSlice = xml.slice(launchOpen, launchClose);
        const runnableEnd = launchSlice.indexOf('</BuildableProductRunnable>');
        if (runnableEnd === -1) continue;

        const insertAt = launchOpen + runnableEnd + '</BuildableProductRunnable>'.length;
        xml = xml.slice(0, insertAt) + storeKitBlock + xml.slice(insertAt);
        fs.writeFileSync(schemePath, xml);
      }

      return cfg;
    },
  ]);
}

module.exports = withListioStorekit;
