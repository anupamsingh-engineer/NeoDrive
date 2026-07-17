import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    plugins: { react },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // Without this, plain no-unused-vars misses member-expression JSX tags like
      // <motion.div> (used throughout the Framer Motion redesign) even though it
      // correctly detects plain <Component> tags.
      'react/jsx-uses-vars': 'error',
      // antd was fully removed in the Tailwind/Framer Motion redesign — block regressions.
      'no-restricted-imports': ['error', { paths: ['antd', '@ant-design/icons'] }],
    },
  },
])
