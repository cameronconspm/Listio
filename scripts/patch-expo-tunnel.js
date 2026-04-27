#!/usr/bin/env node
/**
 * Patches @expo/cli to use NGROK_AUTHTOKEN env var when set.
 * Run after npm install to enable tunnel with your own ngrok account.
 * See .env.example for NGROK_AUTHTOKEN usage.
 */
const path = require('path');
const fs = require('fs');

const targetPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo',
  'node_modules',
  '@expo',
  'cli',
  'build',
  'src',
  'start',
  'server',
  'AsyncNgrok.js'
);

if (!fs.existsSync(targetPath)) {
  console.warn('scripts/patch-expo-tunnel.js: @expo/cli not found at expected path, skipping patch.');
  process.exit(0);
}

let content = fs.readFileSync(targetPath, 'utf8');

// Avoid duplicate patch
if (content.includes('process.env.NGROK_AUTHTOKEN')) {
  process.exit(0);
}

// Replace: use NGROK_AUTHTOKEN when set; omit urlProps (hostname/subdomain) for free ngrok
const search = `const urlProps = await this._getConnectionPropsAsync();
            const url = await instance.connect({
                ...urlProps,
                authtoken: NGROK_CONFIG.authToken,`;

const replace = `const urlProps = await this._getConnectionPropsAsync();
            const customToken = process.env.NGROK_AUTHTOKEN;
            const url = await instance.connect({
                ...(customToken ? {} : urlProps),
                authtoken: customToken || NGROK_CONFIG.authToken,`;

if (content.includes(search)) {
  content = content.replace(search, replace);
  fs.writeFileSync(targetPath, content);
  console.log('scripts/patch-expo-tunnel.js: Patched @expo/cli for NGROK_AUTHTOKEN support.');
} else {
  console.warn('scripts/patch-expo-tunnel.js: Could not find expected code to patch. Expo may have updated.');
}
