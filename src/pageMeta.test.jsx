import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { routes } from './router.jsx';
import { DEFAULT_PAGE_META, PAGE_META } from './data/pageMeta.js';
import { pageMetaFor } from './pageMeta.js';
import { DEFAULT_SITE_URL } from '../lib/site-url.js';
import { sitemapPaths } from '../lib/site-files.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = ['/', '/tea', '/coffee', '/quiz', '/our-story', '/contact', '/shipping-returns', '/privacy'];
const entries = Object.values(PAGE_META);

const head = (selector) => document.head.querySelector(selector);
const content = (selector) => head(selector)?.getAttribute('content');

describe('the page titles and descriptions (src/data/pageMeta.js)', () => {
  it('cover exactly the eight pages in the sitemap', () => {
    expect(Object.keys(PAGE_META)).toEqual(PAGES);
    expect(Object.keys(PAGE_META)).toEqual(sitemapPaths({ products: [], guides: [] }));
  });

  it('give every page a title and a description no other page has', () => {
    const titles = [DEFAULT_PAGE_META, ...entries].map((meta) => meta.title);
    const descriptions = [DEFAULT_PAGE_META, ...entries].map((meta) => meta.description);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  it.each(Object.entries(PAGE_META))('%s has a title that names the shop and a description of search length', (_, meta) => {
    expect(meta.title).toMatch(/Sip Haven/);
    expect(meta.title.length).toBeLessThanOrEqual(60);
    expect(meta.description.length).toBeGreaterThanOrEqual(70);
    expect(meta.description.length).toBeLessThanOrEqual(160);
  });

  it('is marked as draft copy and is plain ASCII', () => {
    const source = readFileSync(path.join(ROOT, 'src/data/pageMeta.js'), 'utf8');
    expect(source.startsWith("// DRAFT COPY: needs Joseph's approval.")).toBe(true);
    // eslint-disable-next-line no-control-regex
    expect(source).toMatch(/^[\x09\x0A\x0D\x20-\x7E]*$/);
  });
});

describe('pageMetaFor', () => {
  it('gives a listed page its canonical on the shop address', () => {
    expect(pageMetaFor('/quiz')).toEqual({ ...PAGE_META['/quiz'], canonical: `${DEFAULT_SITE_URL}/quiz` });
    expect(pageMetaFor('/').canonical).toBe(`${DEFAULT_SITE_URL}/`);
  });

  it('gives any other page the default tags and no canonical', () => {
    expect(pageMetaFor('/products/some-tea')).toEqual({ ...DEFAULT_PAGE_META, canonical: null });
    expect(pageMetaFor('/no-such-page').canonical).toBeNull();
  });
});

describe('the tags in the page head', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.title = '';
  });

  function renderAt(url) {
    const router = createMemoryRouter(routes, { initialEntries: [url] });
    render(<RouterProvider router={router} />);
    return router;
  }

  it.each(PAGES)('are set for %s', (url) => {
    renderAt(url);
    const { title, description } = PAGE_META[url];
    expect(document.title).toBe(title);
    expect(content('meta[name="description"]')).toBe(description);
    expect(content('meta[property="og:title"]')).toBe(title);
    expect(content('meta[property="og:description"]')).toBe(description);
    expect(content('meta[property="og:url"]')).toBe(DEFAULT_SITE_URL + url);
    expect(head('link[rel="canonical"]')).toHaveAttribute('href', DEFAULT_SITE_URL + url);
  });

  it('change as the shopper moves between pages, and drop the canonical off the list', async () => {
    const router = renderAt('/');
    expect(document.title).toBe(PAGE_META['/'].title);

    await act(() => router.navigate('/quiz'));
    expect(screen.getByRole('heading', { level: 1, name: 'Find your cup' })).toBeInTheDocument();
    expect(document.title).toBe(PAGE_META['/quiz'].title);
    expect(head('link[rel="canonical"]')).toHaveAttribute('href', `${DEFAULT_SITE_URL}/quiz`);

    await act(() => router.navigate('/no-such-page'));
    expect(document.title).toBe(DEFAULT_PAGE_META.title);
    expect(content('meta[name="description"]')).toBe(DEFAULT_PAGE_META.description);
    expect(head('link[rel="canonical"]')).toBeNull();
    expect(head('meta[property="og:url"]')).toBeNull();
  });

  it('keep one of each tag however many pages are visited', async () => {
    const router = renderAt('/');
    for (const url of PAGES) await act(() => router.navigate(url));
    expect(document.head.querySelectorAll('title')).toHaveLength(1);
    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
  });
});

describe('index.html', () => {
  const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  it('loads no fonts from Google', () => {
    expect(html).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
  });

  it('keeps the page tags in the block the build replaces', () => {
    expect(html).toMatch(/<!-- page-meta -->[\s\S]*<title>[\s\S]*<!-- \/page-meta -->/);
  });
});
