import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PAGE_META } from '../src/data/pageMeta.js';
import {
  OUR_STORY_FAQS,
  OUR_STORY_LINKS,
  OUR_STORY_PARAGRAPHS,
  OUR_STORY_SUBHEAD,
  OUR_STORY_TITLE,
  SIP_HAVEN_SLOGAN,
  ourStoryStructuredData,
} from '../src/data/ourStory.js';
import { DEFAULT_SITE_URL } from './site-url.js';
import { ourStoryArticleHtml, withOurStoryContent } from './our-story-html.js';

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const visible = (html) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, '');

const META_DESCRIPTION =
  'Sip Haven is an online tea and coffee store for slow mornings and quiet moments. Loose-leaf tea, K-Cups, and whole bean and ground coffee.';

describe('approved our story copy', () => {
  it('keeps the title and description Joseph approved, and no other page meta', () => {
    expect(PAGE_META['/our-story']).toEqual({
      title: 'Our Story | Sip Haven Tea and Coffee',
      description: META_DESCRIPTION,
    });
  });

  it('keeps the story and the three answers word for word', () => {
    expect(OUR_STORY_TITLE).toBe('Our story');
    expect(OUR_STORY_SUBHEAD).toBe('Sip Haven is a place to slow down and remember.');
    expect(OUR_STORY_PARAGRAPHS).toEqual([
      'Life is a sum of all your experiences. A good cup gives you a reason to stop, take a breath and let it all catch up with you.',
      "A mug of coffee before the house wakes up. A pot of loose-leaf tea on a Sunday afternoon. Small rituals that leave you grateful for how far you've come.",
      "We're building a collection of loose-leaf tea, tea bags, tea K-Cups, and whole bean and ground coffee for those pauses.",
      "Not sure where to start? Try the quiz and we'll point you toward a cup you might love.",
    ]);
    expect(OUR_STORY_LINKS.map((link) => [link.label, link.href])).toEqual([
      ['Take the quiz', '/quiz'],
      ['Browse tea', '/tea'],
      ['Browse coffee', '/coffee'],
    ]);
    expect(OUR_STORY_FAQS).toEqual([
      {
        question: 'What is Sip Haven?',
        answer:
          'Sip Haven is an online tea and coffee store. We make tea and coffee for slow mornings, long talks and quiet moments to look back on.',
      },
      {
        question: 'What does Sip Haven sell?',
        answer:
          "Loose-leaf tea, tea bags and tea K-Cups, plus whole bean and ground coffee. Our first collection is on the way. Leave your email and we'll let you know when it's ready.",
      },
      {
        question: 'How do I pick a tea or coffee?',
        answer:
          "Take our quick quiz. Answer a few questions and we'll point you toward a cup you might love.",
      },
    ]);
  });
});

describe('our story structured data', () => {
  const { organization, faqPage } = ourStoryStructuredData();

  it('describes Sip Haven and the three questions, and invents nothing else', () => {
    expect(organization).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Sip Haven',
      legalName: 'Sip Haven Co. LLC',
      url: 'https://www.siphaven.com',
      description: META_DESCRIPTION,
      slogan: 'A little haven in every cup.',
    });
    expect(organization.url).toBe(DEFAULT_SITE_URL);
    expect(organization.description).toBe(PAGE_META['/our-story'].description);
    expect(faqPage).toEqual({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: OUR_STORY_FAQS.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    });

    const keys = JSON.stringify(ourStoryStructuredData());
    for (const extra of ['address', 'telephone', 'logo', 'sameAs', 'priceRange', 'aggregateRating']) {
      expect(keys).not.toContain(`"${extra}"`);
    }
  });

  it('uses the slogan already on the home page', () => {
    expect(SIP_HAVEN_SLOGAN).toBe('A little haven in every cup.');
    expect(read('../src/pages/Home.jsx')).toContain(SIP_HAVEN_SLOGAN);
  });
});

describe('our story HTML for crawlers', () => {
  const shell = [
    '<!doctype html><html><head>',
    '<!-- page-meta --><title>Old</title><!-- /page-meta -->',
    '</head><body><div id="root"></div>',
    '<script type="module" src="/assets/index.js"></script></body></html>',
  ].join('');

  it('puts the story in the raw HTML, with the quiz still linked, and JSON-LD in the head', () => {
    const html = withOurStoryContent(shell);
    expect(visible(html)).toContain(OUR_STORY_TITLE);
    expect(visible(html)).toContain(OUR_STORY_SUBHEAD);
    expect(html).toMatch(/<h1[^>]*>Our story<\/h1>/);
    for (const paragraph of OUR_STORY_PARAGRAPHS) expect(visible(html)).toContain(paragraph);
    for (const link of OUR_STORY_LINKS) {
      expect(html).toContain(`<a href="${link.href}"`);
      expect(visible(html)).toContain(link.label);
    }
    expect(html).not.toContain('<blockquote');
    expect(html).not.toContain('A quiet corner');
    for (const faq of OUR_STORY_FAQS) {
      expect(visible(html)).toContain(faq.question);
      expect(visible(html)).toContain(faq.answer);
    }
    expect(html).toContain('<h2 ');
    expect(html).toContain('<h3 ');
    expect(html).toContain('<a href="/quiz"');
    expect(html).toContain('<title>Old</title>');

    const blocks = [...html.matchAll(/<script type="application\/ld\+json" id="([^"]+)">([^<]*)<\/script>/g)];
    expect(blocks.map((match) => match[1])).toEqual([
      'sip-haven-organization-jsonld',
      'sip-haven-faqpage-jsonld',
    ]);
    expect(JSON.parse(blocks[0][2])).toEqual(ourStoryStructuredData().organization);
    expect(JSON.parse(blocks[1][2])).toEqual(ourStoryStructuredData().faqPage);
    expect(html).toContain('document.getElementById("sip-haven-our-story-prerender")?.remove()');
  });

  it('leaves the app root empty so React still mounts, and does not add the story twice', () => {
    const once = withOurStoryContent(shell);
    expect(once).toContain('<div id="root"></div>');
    expect(withOurStoryContent(once)).toBe(once);
  });

  it('fails the build when the document has nowhere to put the story', () => {
    expect(() => withOurStoryContent('<html></html>')).toThrow(/body/);
  });

  it('writes each question closed, with its answer still in the HTML', () => {
    const article = ourStoryArticleHtml();
    expect(article.match(/<details /g)).toHaveLength(3);
    expect(article).not.toMatch(/<details[^>]* open/);
    expect(article.match(/<summary /g)).toHaveLength(3);
    expect(article.match(/<h3 /g)).toHaveLength(3);
    for (const faq of OUR_STORY_FAQS) {
      expect(article).toContain(`>${faq.question}<`);
      expect(article).toContain(`>${faq.answer}<`);
    }
  });
});
