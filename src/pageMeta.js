// The build already writes each page's tags into its HTML (lib/page-html.js). These keep
// them right as a shopper moves between pages without a reload (components/PageMeta.jsx):
// the title, the description and their Open Graph copies, and the canonical link and
// og:url, which only the pages in PAGE_META have.
import { canonicalUrl } from '../lib/site-url.js';
import { DEFAULT_PAGE_META, PAGE_META } from './data/pageMeta.js';

/** The tags for a path: { title, description, canonical }; canonical is null off the list. */
export function pageMetaFor(pathname) {
  const meta = PAGE_META[pathname];
  if (!meta) return { ...DEFAULT_PAGE_META, canonical: null };
  return { ...meta, canonical: canonicalUrl(import.meta.env.SITE_URL, pathname) };
}

// The <head> element matching `selector`, made with `attributes` if there is none.
function headTag(tag, selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
    document.head.append(element);
  }
  return element;
}

const setMeta = (attribute, key, content) =>
  headTag('meta', `meta[${attribute}="${key}"]`, { [attribute]: key }).setAttribute('content', content);

/** Writes these tags into document.head, adding any that are missing. */
export function applyPageMeta({ title, description, canonical }) {
  document.title = title;
  setMeta('name', 'description', description);
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:description', description);
  if (canonical) {
    setMeta('property', 'og:url', canonical);
    headTag('link', 'link[rel="canonical"]', { rel: 'canonical' }).setAttribute('href', canonical);
  } else {
    document.head.querySelector('meta[property="og:url"]')?.remove();
    document.head.querySelector('link[rel="canonical"]')?.remove();
  }
}
