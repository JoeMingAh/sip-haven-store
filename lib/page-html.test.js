import { describe, it, expect } from 'vitest';
import {
  fontPreloadTags,
  htmlFileFor,
  metaTags,
  pageHtmlFiles,
  pageModulePreloadTags,
  withMeta,
} from './page-html.js';

const HTML = [
  '<!doctype html>',
  '<html><head>',
  '<!-- page-meta --><title>Default</title><!-- /page-meta -->',
  '<script type="module" src="/assets/index-abc.js"></script>',
  '</head><body><div id="root"></div></body></html>',
].join('\n');

const chunk = (fileName, { imports = [], isEntry = false, facadeModuleId = null } = {}) => ({
  type: 'chunk',
  fileName,
  imports,
  isEntry,
  facadeModuleId,
});
const asset = (fileName) => ({ type: 'asset', fileName });

const BUNDLE = {
  'assets/index-abc.js': chunk('assets/index-abc.js', { isEntry: true, imports: ['assets/react-1.js'] }),
  'assets/react-1.js': chunk('assets/react-1.js'),
  'assets/Quiz-2.js': chunk('assets/Quiz-2.js', {
    facadeModuleId: '/repo/src/pages/Quiz.jsx',
    imports: ['assets/react-1.js', 'assets/ProductCard-3.js'],
  }),
  'assets/ProductCard-3.js': chunk('assets/ProductCard-3.js'),
  'assets/nunito-sans-latin-400-normal-Xy12.woff2': asset('assets/nunito-sans-latin-400-normal-Xy12.woff2'),
  'assets/nunito-sans-latin-400-normal-Xy12.woff': asset('assets/nunito-sans-latin-400-normal-Xy12.woff'),
};

describe('htmlFileFor', () => {
  it('names the home page index.html and every other page after its address', () => {
    expect(htmlFileFor('/')).toBe('index.html');
    expect(htmlFileFor('/our-story')).toBe('our-story.html');
  });
});

describe('metaTags and withMeta', () => {
  it('writes the title and description, their Open Graph copies and the canonical link', () => {
    const tags = metaTags({ title: 'Tea & more', description: 'Say "hi"' }, 'https://x.example/tea');
    expect(tags).toContain('<title>Tea &amp; more</title>');
    expect(tags).toContain('<meta name="description" content="Say &quot;hi&quot;" />');
    expect(tags).toContain('<meta property="og:title" content="Tea &amp; more" />');
    expect(tags).toContain('<meta property="og:description" content="Say &quot;hi&quot;" />');
    expect(tags).toContain('<meta property="og:url" content="https://x.example/tea" />');
    expect(tags).toContain('<link rel="canonical" href="https://x.example/tea" />');
  });

  it('leaves out the canonical link and og:url when there is none', () => {
    const tags = metaTags({ title: 'T', description: 'D' });
    expect(tags).not.toContain('canonical');
    expect(tags).not.toContain('og:url');
  });

  it('replaces only the page-meta block', () => {
    const html = withMeta(HTML, { title: 'New', description: 'D' });
    expect(html).toContain('<title>New</title>');
    expect(html).not.toContain('Default');
    expect(html).toContain('<script type="module" src="/assets/index-abc.js"></script>');
  });

  it('fails loudly when index.html has no page-meta block', () => {
    expect(() => withMeta('<html></html>', { title: 'T', description: 'D' })).toThrow(/page-meta/);
  });
});

describe('fontPreloadTags', () => {
  it('preloads the hashed woff2 file of each font', () => {
    expect(fontPreloadTags(BUNDLE, ['nunito-sans-latin-400-normal'])).toEqual([
      '<link rel="preload" href="/assets/nunito-sans-latin-400-normal-Xy12.woff2" as="font" type="font/woff2" crossorigin />',
    ]);
  });

  it('fails the build when a font is missing', () => {
    expect(() => fontPreloadTags(BUNDLE, ['lora-latin-600-normal'])).toThrow(/lora-latin-600-normal/);
  });
});

describe('pageModulePreloadTags', () => {
  it("preloads the page's chunk and its imports, less what the entry already loads", () => {
    expect(pageModulePreloadTags(BUNDLE, 'src/pages/Quiz.jsx')).toEqual([
      '<link rel="modulepreload" crossorigin href="/assets/Quiz-2.js" />',
      '<link rel="modulepreload" crossorigin href="/assets/ProductCard-3.js" />',
    ]);
  });

  it('fails the build when the page has no chunk of its own', () => {
    expect(() => pageModulePreloadTags(BUNDLE, 'src/pages/Home.jsx')).toThrow(/Home\.jsx/);
  });
});

describe('pageHtmlFiles', () => {
  const files = Object.fromEntries(
    pageHtmlFiles({
      html: HTML,
      bundle: BUNDLE,
      siteUrl: 'https://www.siphaven.com/',
      pageMeta: {
        '/': { title: 'Home', description: 'Home page' },
        '/quiz': { title: 'Quiz', description: 'Quiz page' },
      },
      defaultMeta: { title: 'Sip Haven', description: 'Default' },
      pageModules: { '/quiz': 'src/pages/Quiz.jsx' },
      fonts: ['nunito-sans-latin-400-normal'],
    }).map(({ fileName, source }) => [fileName, source]),
  );

  it('writes one file per page, plus app.html and 404.html', () => {
    expect(Object.keys(files).sort()).toEqual(['404.html', 'app.html', 'index.html', 'quiz.html']);
  });

  it("gives each page its own tags and a canonical on the site's address", () => {
    expect(files['index.html']).toContain('<link rel="canonical" href="https://www.siphaven.com/" />');
    expect(files['quiz.html']).toContain('<title>Quiz</title>');
    expect(files['quiz.html']).toContain('<link rel="canonical" href="https://www.siphaven.com/quiz" />');
  });

  it("preloads a page's own chunk only in that page's file", () => {
    expect(files['quiz.html']).toContain('href="/assets/Quiz-2.js"');
    expect(files['index.html']).not.toContain('Quiz-2.js');
  });

  it('preloads the fonts in every file', () => {
    for (const source of Object.values(files)) {
      expect(source).toContain('nunito-sans-latin-400-normal-Xy12.woff2');
    }
  });

  it('gives app.html and 404.html the default tags and no canonical', () => {
    expect(files['404.html']).toBe(files['app.html']);
    expect(files['404.html']).toContain('<title>Sip Haven</title>');
    expect(files['404.html']).not.toContain('canonical');
  });
});
