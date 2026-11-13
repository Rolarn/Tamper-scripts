import js from '@eslint/js';
import globals from 'globals';
import userscripts from 'eslint-plugin-userscripts';

export default [
  { ignores: ['node_modules/', '**/*.meta.js'] },

  js.configs.recommended,

  // Юзерскрипты: браузер + API Tampermonkey / Userscripts: browser + Tampermonkey API
  {
    files: ['scripts/**/*.user.js'],
    plugins: { userscripts },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        GM_xmlhttpRequest: 'readonly',
        GM_setClipboard: 'readonly',
        GM_registerMenuCommand: 'readonly',
      },
    },
    rules: {
      ...userscripts.configs.recommended.rules,
      // @match *://*/* — осознанный выбор для универсальных скриптов / deliberate for universal scripts
      'userscripts/better-use-match': 'off',
      'no-unused-vars': ['error', { caughtErrors: 'none' }],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },

  // Инструменты и тесты: Node.js / Tools and tests: Node.js
  {
    files: ['tools/**/*.mjs', 'test/**/*.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
];
