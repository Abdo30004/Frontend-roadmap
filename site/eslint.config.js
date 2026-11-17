import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'src/generated'] },

  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
      // French text uses non-breaking spaces before « » : ? ! on purpose.
      'no-irregular-whitespace': ['error', { skipStrings: true, skipComments: true, skipTemplates: true, skipJSXText: true }],
    },
  },

  // Demo files export plain strings (scenario, task…) next to their components on purpose.
  {
    files: ['src/demos/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  // Build scripts and config files run in Node.
  {
    files: ['scripts/**/*.mjs', '*.config.{js,ts}'],
    extends: [js.configs.recommended],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: globals.node },
  },

  // Turn off every rule that would fight with Prettier. Keep this last.
  prettier,
);
