import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { routes } from './router.jsx';

// vercel.json sends only the app's own routes to index.html. Anything else falls
// through to the build's 404.html with a real 404 status (see lib/site-files.js). This
// checks that every route in src/router.jsx has its rewrite, and that addresses that
// are no page (and robots.txt and sitemap.xml) do not.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vercel = JSON.parse(readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const rewrites = vercel.rewrites ?? [];

// Our sources are plain paths whose segments are words or :params. Anything fancier
// fails the shape test below instead of being matched wrongly here.
const SUPPORTED_SOURCE = /^(?:\/(?:[a-z0-9-]+|:[a-z]+))+$/;
const toRegExp = (source) =>
  new RegExp(`^${source.replace(/:[a-z]+/g, '[^/]+')}$`);
const matchers = rewrites.map((rewrite) => toRegExp(rewrite.source));
// '/' is index.html itself, so it needs no rewrite.
const servesApp = (url) => url === '/' || matchers.some((matcher) => matcher.test(url));

// Every route path in the router, as an address: params filled in with an example.
function routePaths(list, parent = '') {
  return list.flatMap((route) => {
    if (route.path === '*') return [];
    if (route.index) return [parent || '/'];
    const here = route.path === '/' ? '' : `${parent}/${route.path}`;
    return [here || '/', ...routePaths(route.children ?? [], here)];
  });
}
const PATHS = [...new Set(routePaths(routes))].map((route) => route.replace(/:[a-z]+/g, 'an-example'));

describe('vercel.json rewrites', () => {
  it('has no catch-all that would answer 200 to every address', () => {
    for (const { source } of rewrites) expect(source).not.toMatch(/\(\.\*\)|:path\*|\(\?!/);
  });

  it.each(rewrites.map((rewrite) => [rewrite.source, rewrite.destination]))(
    'sends %s to %s, in a shape this check can read',
    (source, destination) => {
      expect(source).toMatch(SUPPORTED_SOURCE);
      expect(destination).toBe('/index.html');
    },
  );

  it('sees the routes it is checking', () => {
    expect(PATHS).toEqual(expect.arrayContaining(['/', '/tea', '/quiz', '/products/an-example']));
  });

  it.each(PATHS)('loads the app for the route %s', (url) => {
    expect(servesApp(url)).toBe(true);
  });

  it.each([
    '/nope',
    '/teas',
    '/tea/extra',
    '/products',
    '/products/a/b',
    '/learn/a/b',
    '/robots.txt',
    '/sitemap.xml',
    '/api/subscribe',
    '/api/quiz-notes',
  ])('leaves %s to its own file, its function or the 404 page', (url) => {
    expect(servesApp(url)).toBe(false);
  });

  it('turns trailing slashes off, so /tea/ redirects to /tea instead of 404ing', () => {
    expect(vercel.trailingSlash).toBe(false);
  });
});
