import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PAGE_META } from '../src/data/pageMeta.js';
import {
  OUR_STORY_CTA,
  OUR_STORY_EYEBROW,
  OUR_STORY_FAQS,
  OUR_STORY_HEADLINE,
  OUR_STORY_INTRO,
  OUR_STORY_QUOTE,
  OUR_STORY_SECTIONS,
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
    expect(OUR_STORY_EYEBROW).toBe('Our story');
    expect(OUR_STORY_HEADLINE).toBe('Sip Haven is a place to slow down and remember.');
    expect(`${OUR_STORY_INTRO} ${OUR_STORY_QUOTE}`).toBe(
      "Life is a sum of all your experiences. Most days we're too busy living them to notice. A good cup gives you a reason to stop, take a breath and let it all catch up with you.",
    );
    const [quietCorner, why, brewing] = OUR_STORY_SECTIONS;
    expect([quietCorner.label, why.label, brewing.label]).toEqual([
      'A quiet corner',
      'Why tea and coffee',
      "What we're brewing",
    ]);
    expect(`${quietCorner.text} ${quietCorner.moments[0]} ${quietCorner.moments[1]}`).toBe(
      "That's what we want Sip Haven to feel like: a quiet corner where the kettle is always on and there's time to look back. A mug of coffee before the house wakes up, thinking about yesterday. A pot of loose-leaf tea on a Sunday afternoon, remembering a trip, an old friend or a moment you almost forgot.",
    );
    expect(why.text).toBe(
      "We love tea and coffee for the same reason. Both turn an ordinary moment into a little ritual, and the best rituals leave you grateful for how far you've come.",
    );
    expect(brewing.text).toBe(
      "We're building a collection of loose-leaf tea, tea bags, tea K-Cups, and whole bean and ground coffee for those pauses. Pull up a chair, pour a cup and take a look around.",
    );
    expect(`${OUR_STORY_CTA.prompt} ${OUR_STORY_CTA.link}`).toBe(
      "Not sure where to start? Try the quiz and we'll point you toward a cup you might like.",
    );
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
    expect(visible(html)).toContain(OUR_STORY_HEADLINE);
    expect(visible(html)).toContain(`${OUR_STORY_CTA.prompt}`);
    expect(visible(html)).toContain(OUR_STORY_CTA.link);
    for (const section of OUR_STORY_SECTIONS) expect(visible(html)).toContain(section.label);
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

  it('writes headings for the questions, not a script-only disclosure', () => {
    const article = ourStoryArticleHtml();
    expect(article).not.toContain('<details');
    expect(article).not.toContain('accordion');
    expect(article.match(/<h3 /g)).toHaveLength(3);
  });
});
