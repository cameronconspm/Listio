// ESLint v9+ flat config — single source of truth for this repo (`npm run lint`).

const expo = require('eslint-config-expo/flat');

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'jest.setup.js',
      // Edge functions import from https://esm.sh (intentionally not resolvable by eslint-import)
      'supabase/functions/**',
      // Node-only scripts (CommonJS; not linted as browser RN code)
      'scripts/**',
      'plugins/**',
    ],
  },
  // Expo's recommended flat config
  ...expo,

  {
    rules: {
      'react/react-in-jsx-scope': 'off',
    },
  },
];

