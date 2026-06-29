/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'widget',
  name: 'ListioWidget',
  displayName: 'Listio',
  deploymentTarget: '15.1',
  bundleIdentifier: '.ListioWidget',
  frameworks: ['WidgetKit', 'SwiftUI'],
  entitlements: {
    'com.apple.security.application-groups': ['group.com.cameroncons.listio'],
  },
};
