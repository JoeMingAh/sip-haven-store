import { describe, it, expect, vi } from 'vitest';
import { DEFAULT_SITE_URL, robotsTxt, siteFiles, sitemapPaths, sitemapXml } from './site-files.js';

const product = (slug, { buyable = true } = {}) => ({
  slug,
  variants: [{ id: 'v', stripe_price_id: buyable ? 'price_1' : undefined }],
});

describe('robotsTxt', () => {
  it('lets the shop be crawled, keeps the API and checkout pages out, and names the sitemap', () => {
    expect(robotsTxt('https://siphaven.com')).toBe(
      [
        'User-agent: *',
        'Disallow: /api/',
        'Disallow: /cart',
        'Disallow: /success',
        '',
        'Sitemap: https://siphaven.com/sitemap.xml',
        '',
      ].join('\n'),
    );
  });

  it('uses the default address when SITE_URL is not set, and drops a trailing slash', () => {
    expect(robotsTxt(undefined)).toContain(`Sitemap: ${DEFAULT_SITE_URL}/sitemap.xml`);
    expect(robotsTxt('https://preview.example.com/ ')).toContain(
      'Sitemap: https://preview.example.com/sitemap.xml',
    );
  });
});

describe('sitemapPaths', () => {
  it('lists the shop pages, not the cart or the order confirmation', () => {
    const paths = sitemapPaths({ products: [], guides: [] });
    expect(paths).toEqual([
      '/',
      '/tea',
      '/coffee',
      '/quiz',
      '/our-story',
      '/contact',
      '/shipping-returns',
      '/privacy',
    ]);
  });

  it('adds Learn and each guide once there are guides', () => {
    const paths = sitemapPaths({ products: [], guides: [{ slug: 'steeping-basics' }] });
    expect(paths).toEqual(expect.arrayContaining(['/learn', '/learn/steeping-basics']));
  });

  it('adds the products that can be bought while the store is open', () => {
    const products = [product('jasmine-dream'), product('not-yet', { buyable: false })];
    const paths = sitemapPaths({ storeOpen: true, products, guides: [] });
    expect(paths).toContain('/products/jasmine-dream');
    expect(paths).not.toContain('/products/not-yet');
  });

  it('lists no product while the store is closed', () => {
    const paths = sitemapPaths({ storeOpen: false, products: [product('jasmine-dream')], guides: [] });
    expect(paths.some((path) => path.startsWith('/products/'))).toBe(false);
  });
});

describe('sitemapXml', () => {
  it('is a sitemap with one absolute URL per path', () => {
    expect(sitemapXml('https://siphaven.com/', ['/', '/tea'])).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        '  <url><loc>https://siphaven.com/</loc></url>',
        '  <url><loc>https://siphaven.com/tea</loc></url>',
        '</urlset>',
        '',
      ].join('\n'),
    );
  });

  it('escapes XML special characters', () => {
    expect(sitemapXml('https://a.example?x=1&y=2', ['/'])).toContain(
      '<loc>https://a.example?x=1&amp;y=2/</loc>',
    );
  });
});

describe('siteFiles (the Vite plugin)', () => {
  function build(bundle) {
    const emitted = {};
    const plugin = siteFiles({ siteUrl: 'https://siphaven.com', products: [], guides: [] });
    plugin.generateBundle.call(
      { emitFile: vi.fn((file) => (emitted[file.fileName] = file.source)) },
      {},
      bundle,
    );
    return { plugin, emitted };
  }

  it('only runs for a build, after the HTML plugin has made index.html', () => {
    const { plugin } = build({});
    expect(plugin.apply).toBe('build');
    expect(plugin.enforce).toBe('post');
  });

  it('adds 404.html as a copy of the built index.html, so unknown addresses still load the app', () => {
    const html = '<!doctype html><div id="root"></div><script src="/assets/index.js"></script>';
    const { emitted } = build({ 'index.html': { type: 'asset', source: html } });
    expect(emitted['404.html']).toBe(html);
  });

  it('adds robots.txt and sitemap.xml', () => {
    const { emitted } = build({ 'index.html': { type: 'asset', source: '<html></html>' } });
    expect(emitted['robots.txt']).toBe(robotsTxt('https://siphaven.com'));
    expect(emitted['sitemap.xml']).toContain('<loc>https://siphaven.com/quiz</loc>');
  });
});
