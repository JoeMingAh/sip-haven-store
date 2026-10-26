// The files the build writes beside the app: robots.txt, sitemap.xml and 404.html.
// vite.config.js adds them through siteFiles() below.
//
// Why 404.html: vercel.json only sends the app's own routes to index.html, so an
// address that matches nothing falls through to Vercel, which answers with 404.html
// and a real 404 status. That file is a copy of index.html, so the app still loads
// and React Router shows its own "We couldn't find that page".
//
// robots.txt and sitemap.xml are real files in the build, so Vercel serves them with
// their own content types (text/plain and application/xml) before any rewrite.
import { getProducts, purchasableVariants } from './catalog.js';
import { DEFAULT_SITE_URL, siteRoot } from './site-url.js';
import { withOurStoryContent } from './our-story-html.js';
import { pageHtmlFiles } from './page-html.js';

export { DEFAULT_SITE_URL };

// The pages worth finding in a search engine, in the order they are listed. /cart and
// /success are left out: they only make sense in the middle of a purchase.
const PAGES = ['/', '/tea', '/coffee', '/quiz', '/our-story', '/contact', '/shipping-returns', '/privacy'];

const escapeXml = (text) =>
  text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);

/**
 * Every path in the sitemap. The Learn pages only once there is a guide (the header and
 * footer only link to Learn then too), and product pages only while the store is open
 * and the product can be bought (otherwise the page only says the shop is coming soon).
 */
export function sitemapPaths({ storeOpen = false, products = getProducts(), guides = [] } = {}) {
  const paths = [...PAGES];
  if (guides.length > 0) {
    paths.push('/learn', ...guides.map((guide) => `/learn/${guide.slug}`));
  }
  if (storeOpen) {
    for (const product of products) {
      if (purchasableVariants(product).length > 0) paths.push(`/products/${product.slug}`);
    }
  }
  return paths;
}

/** sitemap.xml for these paths on this site. */
export function sitemapXml(siteUrl, paths) {
  const root = siteRoot(siteUrl);
  const urls = paths.map((path) => `  <url><loc>${escapeXml(root + path)}</loc></url>`);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

// `User-agent: *` is the only group, so every crawler uses it, including Googlebot,
// Bingbot, GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot,
// PerplexityBot and Google-Extended. The disallows are only /api/, /cart and
// /success. Do not add a group that blocks those crawlers, or a Disallow for /.
/** robots.txt: crawl the shop, not the API or the checkout pages, and here is the sitemap. */
export function robotsTxt(siteUrl) {
  return [
    'User-agent: *',
    'Disallow: /api/',
    'Disallow: /cart',
    'Disallow: /success',
    '',
    `Sitemap: ${siteRoot(siteUrl)}/sitemap.xml`,
    '',
  ].join('\n');
}

/**
 * A Vite plugin that adds robots.txt, sitemap.xml and the per-page HTML files (each
 * page's own title, description and canonical, plus app.html and 404.html; see
 * lib/page-html.js) to a production build. our-story.html then gets the story text
 * and JSON-LD (lib/our-story-html.js). That does not change how titles, descriptions
 * or Open Graph tags are written. `options` are those of sitemapPaths, plus siteUrl
 * and the pageMeta, defaultMeta, pageModules and fonts of pageHtmlFiles.
 */
export function siteFiles({ siteUrl, pageMeta = {}, defaultMeta, pageModules, fonts, ...options } = {}) {
  return {
    name: 'sip-haven-site-files',
    apply: 'build',
    // After Vite's own HTML plugin, which puts index.html in the bundle.
    enforce: 'post',
    generateBundle(_outputOptions, bundle) {
      const index = bundle['index.html'];
      if (index?.type === 'asset') {
        const files = pageHtmlFiles({
          html: String(index.source),
          bundle,
          siteUrl,
          pageMeta,
          defaultMeta: defaultMeta ?? { title: 'Sip Haven', description: '' },
          pageModules,
          fonts,
        });
        for (const { fileName, source } of files) {
          // Titles and descriptions are already in `source`. Only /our-story also
          // needs its text in the file, for crawlers that do not run JavaScript.
          const html = fileName === 'our-story.html' ? withOurStoryContent(source) : source;
          if (fileName === 'index.html') index.source = html;
          else this.emitFile({ type: 'asset', fileName, source: html });
        }
      }
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt(siteUrl) });
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: sitemapXml(siteUrl, sitemapPaths(options)),
      });
    },
  };
}
