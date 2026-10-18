import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    // Code that runs in Node (the scripts, the Vercel functions and the shared lib),
    // so `process`, `Buffer` and the like are real here.
    files: ['scripts/**/*.js', 'api/**/*.js', 'lib/**/*.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
