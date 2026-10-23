// The shop's public address, shared by the build (robots.txt, sitemap.xml, each page's
// canonical link) and the browser bundle (the canonical link after a client-side
// navigation). Kept apart from site-files.js so the bundle does not pull in the catalog.

/** The shop's address when SITE_URL is not set for the build. */
export const DEFAULT_SITE_URL = 'https://www.siphaven.com';

/** 'https://www.siphaven.com/' -> 'https://www.siphaven.com'; unset -> DEFAULT_SITE_URL. */
export const siteRoot = (siteUrl) => (siteUrl || DEFAULT_SITE_URL).trim().replace(/\/+$/, '');

/** The absolute address of a page: canonicalUrl(undefined, '/tea') -> 'https://www.siphaven.com/tea'. */
export const canonicalUrl = (siteUrl, path) => siteRoot(siteUrl) + path;
