import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist'] },
  {
    files: ['**/*.{js,jsx}'],
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { react: { version: '19.0' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      // Every rule below used to be 'off', which made `npx eslint .` exit clean
      // while hiding ~200 findings — the gate looked green and enforced nothing.
      // Restored in tiers: 'error' where the backlog is cleared and a regression
      // should fail the build, 'warn' where a known backlog remains so new code
      // is still flagged without blocking, and 'off' only with a stated reason.

      // Cleared to zero — a new one is a regression.
      'no-empty': 'error',
      'no-useless-catch': 'error',
      'no-prototype-builtins': 'error',

      // Backlog of dead bindings remains (unused locals/state getters, mostly in
      // Checkout.jsx). Not bugs, so they must not block a build, but new ones
      // should be visible. Underscore-prefixed args stay intentionally ignorable.
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],

      // Stale-closure class. Deliberately 'warn', not 'error': mechanically
      // satisfying this rule can turn a missing dependency into an effect that
      // re-runs every render, so each one needs a judgement call, not autofix.
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/incompatible-library': 'warn',
      'react-hooks/unsupported-syntax': 'warn',

      // Off with a reason: this React Compiler rule fires on ~80 sites because
      // "fetch in an effect, then setState" is the app's standard data-loading
      // pattern. It flags optimisation opportunities, not defects, and turning
      // it on would bury the rules above in noise.
      'react-hooks/set-state-in-effect': 'off',

      // Off by project convention, not oversight: this codebase does not use
      // PropTypes, and apostrophes in copy are intentional.
      'react-refresh/only-export-components': 'off',
      'react/prop-types': 'off',
      'react/no-unescaped-entities': 'off',
    },
  },
  {
    files: ['*.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
]
