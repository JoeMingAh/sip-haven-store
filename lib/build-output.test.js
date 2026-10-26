// Builds the site into a temporary folder and checks the HTML a crawler gets: every page
// its own title, description and canonical, no Google Fonts, the fonts and the page's
// own code preloaded, and each page's code in a chunk of its own.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { PAGE_META } from '../src/data/pageMeta.js';
import { DEFAULT_SITE_URL } from './site-url.js';
import { htmlFileFor } from './page-html.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let outDir;
const read = (file) => readFileSync(path.join(outDir, file), 'utf8');
const tag = (html, pattern) => html.match(pattern)?.[1];
const titleOf = (html) => tag(html, /<title>([^<]*)<\/title>/);
const descriptionOf = (html) => tag(html, /<meta name="description" content="([^"]*)"/);

beforeAll(async () => {
  outDir = mkdtempSync(path.join(tmpdir(), 'sip-haven-build-'));
  await build({ root: ROOT, mode: 'production', logLevel: 'silent', build: { outDir, emptyOutDir: true } });
}, 120_000);

afterAll(() => {
  if (outDir) rmSync(outDir, { recursive: true, force: true });
});

describe('the built site', () => {
  const pages = Object.keys(PAGE_META);

  it('has an HTML file for each page, plus app.html and 404.html', () => {
    const html = readdirSync(outDir).filter((file) => file.endsWith('.html')).sort();
    expect(html).toEqual([...pages.map(htmlFileFor), 'app.html', '404.html'].sort());
  });

  it('never loads anything from Google Fonts', () => {
    for (const file of readdirSync(outDir).filter((name) => name.endsWith('.html'))) {
      expect(read(file)).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
    }
    for (const file of readdirSync(path.join(outDir, 'assets')).filter((name) => /\.(css|js)$/.test(name))) {
      expect(read(`assets/${file}`)).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
    }
  });

  it.each(pages)('serves %s with its own title, description and canonical', (page) => {
    const html = read(htmlFileFor(page));
    expect(titleOf(html)).toBe(PAGE_META[page].title);
    expect(descriptionOf(html)).toBe(PAGE_META[page].description);
    expect(html).toContain(`<meta property="og:title" content="${PAGE_META[page].title}" />`);
    expect(html).toContain(`<link rel="canonical" href="${DEFAULT_SITE_URL}${page}" />`);
    expect(html.match(/<title>/g)).toHaveLength(1);
  });

  it('gives no two pages the same title or description', () => {
    const html = pages.map((page) => read(htmlFileFor(page)));
    expect(new Set(html.map(titleOf)).size).toBe(pages.length);
    expect(new Set(html.map(descriptionOf)).size).toBe(pages.length);
  });

  it('serves the 404 page with no canonical', () => {
    expect(read('404.html')).not.toContain('rel="canonical"');
  });

  it('self-hosts the fonts as woff2, Latin only, and preloads the main weights', () => {
    const fonts = readdirSync(path.join(outDir, 'assets')).filter((name) => name.endsWith('.woff2'));
    expect(fonts.some((name) => name.startsWith('lora-latin-600-normal'))).toBe(true);
    expect(fonts.some((name) => name.startsWith('nunito-sans-latin-400-normal'))).toBe(true);
    expect(fonts.filter((name) => !/-latin-/.test(name))).toEqual([]);
    const html = read('index.html');
    expect(html).toMatch(/<link rel="preload" href="\/assets\/nunito-sans-latin-400-normal-[^"]+\.woff2" as="font"/);
    expect(html).toMatch(/<link rel="preload" href="\/assets\/lora-latin-600-normal-[^"]+\.woff2" as="font"/);
    const css = readdirSync(path.join(outDir, 'assets')).filter((name) => name.endsWith('.css'));
    expect(css.map((name) => read(`assets/${name}`)).join('')).toContain('font-display:swap');
  });

  it("preloads each page's own code, and not another page's", () => {
    const home = read('index.html');
    const quiz = read('quiz.html');
    expect(home).toMatch(/rel="modulepreload" crossorigin href="\/assets\/Home-[^"]+\.js"/);
    expect(home).not.toMatch(/Quiz-[^"]+\.js/);
    expect(quiz).toMatch(/rel="modulepreload" crossorigin href="\/assets\/Quiz-[^"]+\.js"/);
    expect(quiz).not.toMatch(/Home-[^"]+\.js/);
  });

  it('puts the our story copy and JSON-LD in the raw our-story.html, and not on other pages', () => {
    const html = read('our-story.html');
    const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, '');
    expect(titleOf(html)).toBe('Our Story | Sip Haven Tea and Coffee');
    expect(descriptionOf(html)).toBe(PAGE_META['/our-story'].description);
    expect(html).toContain(`<meta property="og:title" content="${PAGE_META['/our-story'].title}" />`);
    expect(html).toContain(`<meta property="og:description" content="${PAGE_META['/our-story'].description}" />`);
    expect(text).toContain('Sip Haven is a place to slow down and remember.');
    expect(text).toContain('A quiet corner');
    expect(text).toContain('Why tea and coffee');
    expect(text).toContain("What we're brewing");
    expect(text).toContain("Try the quiz and we'll point you toward a cup you might like.");
    expect(text).toContain('What is Sip Haven?');
    expect(text).toContain('What does Sip Haven sell?');
    expect(text).toContain('How do I pick a tea or coffee?');
    expect(html).toContain('"@type":"Organization"');
    expect(html).toContain('"legalName":"Sip Haven Co. LLC"');
    expect(html).toContain('"@type":"FAQPage"');
    expect(html).not.toMatch(/noindex/i);
    expect(read('index.html')).not.toContain('FAQPage');
    expect(read('tea.html')).not.toContain('sip-haven-our-story-prerender');
  });
});
