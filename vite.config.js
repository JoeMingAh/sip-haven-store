import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { storeFlagDefine } from './lib/store-flag.js'
import { siteFiles } from './lib/site-files.js'
import { GUIDES } from './src/data/guides.js'

export default defineConfig(({ mode }) => {
  // The empty prefix reads every variable, not only the VITE_ ones: process.env first,
  // then the .env files. Only the two store flags and SITE_URL are taken from it.
  const { STORE_OPEN, VITE_STORE_OPEN, SITE_URL } = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      // robots.txt, sitemap.xml and 404.html for the build (see lib/site-files.js). The
      // store flag is read the way isStoreOpen() reads it.
      siteFiles({
        siteUrl: SITE_URL,
        storeOpen: STORE_OPEN === 'true' || VITE_STORE_OPEN === 'true',
        guides: GUIDES,
      }),
    ],
    // STORE_OPEN is the one store flag. The pages get their VITE_STORE_OPEN from it unless
    // it is set itself, and a build where the two disagree fails (see lib/store-flag.js).
    define: storeFlagDefine(mode, { STORE_OPEN, VITE_STORE_OPEN }),
    // Two test projects. The shared lib, the scripts and the /api functions run in
    // Node. Everything under src/ (React components, pages and the tests that scan
    // the source) runs in jsdom with Testing Library set up. Vitest 4 removed
    // environmentMatchGlobs; projects are its replacement.
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
  }
})
