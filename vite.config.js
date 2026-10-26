import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { storeFlagDefine } from './lib/store-flag.js'
import { siteFiles } from './lib/site-files.js'
import { GUIDES } from './src/data/guides.js'
import { DEFAULT_PAGE_META, PAGE_META } from './src/data/pageMeta.js'

// The lazily loaded module behind each page that has its own HTML file, so that file can
// preload it (see lib/page-html.js). These must match the lazyPage() calls in
// src/router.jsx; the build stops if one has no chunk of its own.
const PAGE_MODULES = {
  '/': 'src/pages/Home.jsx',
  '/tea': 'src/pages/Shop.jsx',
  '/coffee': 'src/pages/Shop.jsx',
  '/quiz': 'src/pages/Quiz.jsx',
  '/our-story': 'src/pages/OurStory.jsx',
  '/contact': 'src/pages/Contact.jsx',
  '/shipping-returns': 'src/pages/ShippingReturns.jsx',
  '/privacy': 'src/pages/Privacy.jsx',
}

// Preloaded on every page: the body text (Nunito Sans 400, and 600 for links and
// buttons) and the headings (Lora 600). The other weights load when first used.
const PRELOAD_FONTS = [
  'nunito-sans-latin-400-normal',
  'nunito-sans-latin-600-normal',
  'lora-latin-600-normal',
]

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
        pageMeta: PAGE_META,
        defaultMeta: DEFAULT_PAGE_META,
        pageModules: PAGE_MODULES,
        fonts: PRELOAD_FONTS,
      }),
    ],
    // STORE_OPEN is the one store flag. The pages get their VITE_STORE_OPEN from it unless
    // it is set itself, and a build where the two disagree fails (see lib/store-flag.js).
    // SITE_URL also reaches the bundle, for the canonical link the app sets as a shopper
    // moves between pages (src/components/PageMeta.jsx).
    define: {
      ...storeFlagDefine(mode, { STORE_OPEN, VITE_STORE_OPEN }),
      'import.meta.env.SITE_URL': JSON.stringify(SITE_URL || ''),
    },
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
