import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const dataAndDexie = [
  { group: ['@/data', '@/data/*'], message: 'Views must not access the data layer. Go through a ViewModel.' },
  { group: ['dexie', 'dexie-react-hooks'], message: 'Views must not use Dexie. Go through a ViewModel.' },
  {
    group: ['@/domain/*', '!@/domain/types'],
    message: 'Views may only import types from @/domain/types. Computed values come from the ViewModel.',
  },
]

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'playwright-report', 'test-results', '.superpowers'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/features/*/views/**', 'src/components/**'],
    rules: { 'no-restricted-imports': ['error', { patterns: dataAndDexie }] },
  },
  {
    files: ['src/domain/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react-dom', 'react/*'], message: 'Domain must stay pure: no React.' },
            { group: ['dexie', 'dexie-react-hooks'], message: 'Domain must not use Dexie.' },
            { group: ['@/data', '@/data/*', '@/features/*', '@/i18n', '@/i18n/*'], message: 'Domain must not depend on outer layers.' },
          ],
        },
      ],
    },
  },
)
