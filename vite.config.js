import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Two test projects. The shared lib, the scripts and the /api functions run in
// Node. Everything under src/ (React components, pages and the tests that scan
// the source) runs in jsdom with Testing Library set up. Vitest 4 removed
// environmentMatchGlobs; projects are its replacement.
export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: [
            'lib/**/*.test.js',
            'scripts/**/*.test.js',
            'api/**/*.test.js',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: ['src/**/*.test.js', 'src/**/*.test.jsx'],
          setupFiles: ['src/test/setup.js'],
        },
      },
    ],
  },
})
