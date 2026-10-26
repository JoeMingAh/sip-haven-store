import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PAGE_META } from '../src/data/pageMeta.js';
import { DEFAULT_SITE_URL, robotsTxt, siteFiles, sitemapPaths, sitemapXml } from './site-files.js';

// Crawlers that must be able to read the shop. `User-agent: *` already covers them;
// naming one of them in robots.txt would stop that group from applying.
const SEARCH_AND_AI_CRAWLERS = [
  'Googlebot',
  'Bingbot',
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'PerplexityBot',
  'Google-Extended',
];

const product = (slug, { buyable = true } = {}) => ({
  slug,
  variants: [{ id: 'v', stripe_price_id: buyable ? 'price_1' : undefined }],
});

describe('robotsTxt', () => {
  it('lets the shop be crawled, keeps the API and checkout pages out, and names the sitemap', () => {
    expect(robotsTxt('https://www.siphaven.com')).toBe(
      [
        'User-agent: *',
        'Disallow: /api/',
        'Disallow: /cart',
        'Disallow: /success',
        '',
        'Sitemap: https://www.siphaven.com/sitemap.xml',
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

  it('does not block search or AI crawlers, and neither do the headers or meta robots', () => {
    const robots = robotsTxt('https://www.siphaven.com');
    expect(robots.match(/^User-agent:.*$/gm)).toEqual(['User-agent: *']);
    expect(robots).not.toMatch(/^Disallow:\s*\/\s*$/m);
    expect(robots).not.toContain('Disallow: /our-story');
    for (const crawler of SEARCH_AND_AI_CRAWLERS) expect(robots).not.toContain(crawler);

    const root = fileURLToPath(new URL('..', import.meta.url));
    const vercel = JSON.parse(readFileSync(`${root}/vercel.json`, 'utf8'));
    expect(JSON.stringify(vercel.headers ?? [])).not.toMatch(/noindex|X-Robots-Tag/i);
    const index = readFileSync(`${root}/index.html`, 'utf8');
    expect(index).not.toMatch(/noindex|<meta[^>]*name="robots"/i);
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
    expect(sitemapXml('https://www.siphaven.com/', ['/', '/tea'])).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        '  <url><loc>https://www.siphaven.com/</loc></url>',
        '  <url><loc>https://www.siphaven.com/tea</loc></url>',
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
    const plugin = siteFiles({ siteUrl: 'https://www.siphaven.com', products: [], guides: [] });
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

  const HTML =
    '<!doctype html><head><!-- page-meta --><title>x</title><!-- /page-meta --></head>' +
    '<div id="root"></div><script src="/assets/index.js"></script>';

  it('adds 404.html, the built index.html with the default tags, so unknown addresses still load the app', () => {
    const { emitted } = build({ 'index.html': { type: 'asset', source: HTML } });
    expect(emitted['404.html']).toContain('<script src="/assets/index.js"></script>');
    expect(emitted['404.html']).toContain('<title>Sip Haven</title>');
    expect(emitted['404.html']).not.toContain('rel="canonical"');
  });

  it('writes each listed page its own HTML, and the home page over index.html', () => {
    const index = { type: 'asset', source: HTML };
    const emitted = {};
    siteFiles({
      products: [],
      guides: [],
      pageMeta: {
        '/': { title: 'Home', description: 'Home page' },
        '/tea': { title: 'Tea', description: 'Tea page' },
      },
    }).generateBundle.call({ emitFile: (file) => (emitted[file.fileName] = file.source) }, {}, {
      'index.html': index,
    });
    expect(index.source).toContain('<title>Home</title>');
    expect(index.source).toContain(`<link rel="canonical" href="${DEFAULT_SITE_URL}/" />`);
    expect(emitted['tea.html']).toContain('<title>Tea</title>');
    expect(emitted['tea.html']).toContain(`<link rel="canonical" href="${DEFAULT_SITE_URL}/tea" />`);
    expect(emitted['app.html']).toBe(emitted['404.html']);
  });

  it('adds robots.txt and sitemap.xml', () => {
    const { emitted } = build({ 'index.html': { type: 'asset', source: HTML } });
    expect(emitted['robots.txt']).toBe(robotsTxt('https://www.siphaven.com'));
    expect(emitted['sitemap.xml']).toContain('<loc>https://www.siphaven.com/quiz</loc>');
  });

  it('adds the our story text and JSON-LD to our-story.html only', () => {
    const html =
      '<!doctype html><head><!-- page-meta --><title>x</title><!-- /page-meta --></head>' +
      '<body><div id="root"></div></body>';
    const index = { type: 'asset', source: html };
    const emitted = {};
    siteFiles({
      products: [],
      guides: [],
      pageMeta: {
        '/our-story': PAGE_META['/our-story'],
        '/tea': PAGE_META['/tea'],
      },
    }).generateBundle.call({ emitFile: (file) => (emitted[file.fileName] = file.source) }, {}, {
      'index.html': index,
    });

    const story = emitted['our-story.html'];
    expect(story).toContain(`<title>${PAGE_META['/our-story'].title}</title>`);
    expect(story).toContain(`content="${PAGE_META['/our-story'].description}"`);
    expect(story).toContain('Sip Haven is a place to slow down and remember.');
    expect(story).toContain('href="/quiz"');
    expect(story).toContain('"@type":"FAQPage"');
    expect(emitted['tea.html']).not.toContain('FAQPage');
    expect(emitted['tea.html']).not.toContain('sip-haven-our-story-prerender');
  });
});
