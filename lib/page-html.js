// One HTML file per page for the build, so a crawler (or a link preview) that does not
// run JavaScript still reads the page's own title, description and canonical link.
// siteFiles() in site-files.js calls pageHtmlFiles() with the built index.html.
//
// What gets written, and how vercel.json serves it:
//   index.html     the home page, served at /
//   tea.html ...   one per page in PAGE_META (src/data/pageMeta.js); /tea is rewritten
//                  to /tea.html, and so on
//   app.html       every other page of the app (product pages, Learn, the cart and the
//                  order confirmation): the default title and description, no canonical
//                  (the app sets one once it knows the page)
//   404.html       the same as app.html; Vercel answers it, with a 404 status, for any
//                  address that is no page
//
// Each page's file also preloads that page's own JavaScript (the routes are loaded
// lazily, see src/router.jsx), so it downloads alongside the main bundle instead of
// after it. Every file preloads the main fonts.
import { canonicalUrl } from './site-url.js';

// index.html keeps the tags each page replaces between these two comments.
export const META_START = '<!-- page-meta -->';
export const META_END = '<!-- /page-meta -->';

const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

/** The file a page's HTML is written to: '/' -> 'index.html', '/our-story' -> 'our-story.html'. */
export const htmlFileFor = (path) => (path === '/' ? 'index.html' : `${path.slice(1)}.html`);

/** The head tags for one page. With no canonical there is no canonical link and no og:url. */
export function metaTags({ title, description }, canonical) {
  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
  ];
  if (canonical) {
    tags.push(
      `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
      `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    );
  }
  return tags.join('\n    ');
}

/** `html` with the page-meta block swapped for these tags. Throws if there is no block. */
export function withMeta(html, meta, canonical) {
  const start = html.indexOf(META_START);
  const end = html.indexOf(META_END);
  if (start === -1 || end < start) {
    throw new Error(`index.html needs its page tags between ${META_START} and ${META_END}.`);
  }
  return `${html.slice(0, start + META_START.length)}\n    ${metaTags(meta, canonical)}\n    ${html.slice(end)}`;
}

const beforeHeadEnd = (html, tags) =>
  tags.length === 0 ? html : html.replace('</head>', `  ${tags.join('\n    ')}\n  </head>`);

const isChunk = (file) => file?.type === 'chunk';

/**
 * The built font files to preload, as link tags. `fonts` are names as the font
 * packages ship them (e.g. 'nunito-sans-latin-400-normal'); the build adds a hash.
 * Throws if one is missing from the bundle, so a renamed font cannot drop silently.
 */
export function fontPreloadTags(bundle, fonts, base = '/') {
  return fonts.map((font) => {
    const file = Object.values(bundle).find(
      (item) => item.type === 'asset' && new RegExp(`(^|/)${font}-[\\w-]+\\.woff2$`).test(item.fileName),
    );
    if (!file) throw new Error(`The font ${font}.woff2 is not in the build.`);
    return `<link rel="preload" href="${base}${file.fileName}" as="font" type="font/woff2" crossorigin />`;
  });
}

/**
 * modulepreload tags for the lazily loaded page module `moduleFile` (e.g.
 * 'src/pages/Quiz.jsx'): its chunk and the chunks it imports, less those the entry
 * already loads. Throws if the module has no chunk of its own.
 */
export function pageModulePreloadTags(bundle, moduleFile, base = '/') {
  const chunks = Object.values(bundle).filter(isChunk);
  const page = chunks.find((chunk) => chunk.facadeModuleId?.replaceAll('\\', '/').endsWith(`/${moduleFile}`));
  if (!page) throw new Error(`${moduleFile} has no chunk of its own. Is it loaded with lazyPage()?`);

  const byName = Object.fromEntries(chunks.map((chunk) => [chunk.fileName, chunk]));
  const graph = (start) => {
    const seen = new Set();
    const visit = (name) => {
      if (seen.has(name) || !byName[name]) return;
      seen.add(name);
      byName[name].imports.forEach(visit);
    };
    visit(start);
    return seen;
  };
  const loadedByEntry = new Set(chunks.filter((chunk) => chunk.isEntry).flatMap((chunk) => [...graph(chunk.fileName)]));

  return [...graph(page.fileName)]
    .filter((name) => !loadedByEntry.has(name))
    .map((name) => `<link rel="modulepreload" crossorigin href="${base}${name}" />`);
}

/**
 * Every HTML file the build should hold, as { fileName, source }, made from the built
 * index.html.
 *
 * @param {object} options
 * @param {string} options.html          The built index.html.
 * @param {object} options.bundle        The Rollup bundle (for chunk and font names).
 * @param {string} [options.siteUrl]     SITE_URL; DEFAULT_SITE_URL when unset.
 * @param {Record<string, {title: string, description: string}>} options.pageMeta
 * @param {{title: string, description: string}} options.defaultMeta
 * @param {Record<string, string>} [options.pageModules]  Page path -> its module file.
 * @param {string[]} [options.fonts]     Fonts to preload on every page.
 */
export function pageHtmlFiles({ html, bundle, siteUrl, pageMeta, defaultMeta, pageModules = {}, fonts = [] }) {
  const shared = beforeHeadEnd(html, fontPreloadTags(bundle, fonts));
  const shell = withMeta(shared, defaultMeta);

  const pages = Object.entries(pageMeta).map(([path, meta]) => {
    const preloads = pageModules[path] ? pageModulePreloadTags(bundle, pageModules[path]) : [];
    return {
      fileName: htmlFileFor(path),
      source: beforeHeadEnd(withMeta(shared, meta, canonicalUrl(siteUrl, path)), preloads),
    };
  });

  return [...pages, { fileName: 'app.html', source: shell }, { fileName: '404.html', source: shell }];
}
