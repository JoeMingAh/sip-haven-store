// Approved copy for /our-story. The page (src/pages/OurStory.jsx) and the built
// our-story.html (lib/our-story-html.js) both read these words, so a crawler that
// does not run JavaScript sees the same story as a visitor.
import { DEFAULT_SITE_URL } from '../../lib/site-url.js';
import { PAGE_META } from './pageMeta.js';

// The same shape as the live page: a leaf, "Our story", a serif subheading, then
// the paragraphs and the three pill links. The questions sit below that.
export const OUR_STORY_TITLE = 'Our story';

export const OUR_STORY_SUBHEAD = 'Sip Haven is a place to slow down and remember.';

export const OUR_STORY_PARAGRAPHS = [
  'Life is a sum of all your experiences. A good cup gives you a reason to stop, take a breath and let it all catch up with you.',
  "A mug of coffee before the house wakes up. A pot of loose-leaf tea on a Sunday afternoon. Small rituals that leave you grateful for how far you've come.",
  "We're building a collection of loose-leaf tea, tea bags, tea K-Cups, and whole bean and ground coffee for those pauses.",
  "Not sure where to start? Try the quiz and we'll point you toward a cup you might love.",
];

export const OUR_STORY_LINKS = [
  { href: '/quiz', label: 'Take the quiz', filled: true },
  { href: '/tea', label: 'Browse tea', filled: false },
  { href: '/coffee', label: 'Browse coffee', filled: false },
];

export const OUR_STORY_QUESTIONS_HEADING = 'Questions';

export const OUR_STORY_FAQS = [
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
];

// Classes shared with the live page, so the static copy matches it if it shows.
// max-w-prose is about 65 characters. The filled button is the only solid accent.
export const STORY_CLASS = {
  page: 'mx-auto w-full max-w-prose px-4 py-10 md:py-14',
  leaf: 'h-16 w-16',
  title: 'mt-4 text-balance font-serif text-4xl font-semibold leading-tight text-sage-deep md:text-5xl',
  subhead: 'mt-4 text-pretty font-serif text-2xl leading-snug',
  body: 'mt-5 text-pretty text-lg leading-relaxed',
  actions: 'mt-8 flex flex-wrap gap-3',
  filled:
    'inline-flex min-h-12 items-center rounded-full bg-sage-deep px-7 text-base font-semibold text-cream hover:bg-ink',
  outline:
    'inline-flex min-h-12 items-center rounded-full border-2 border-sage-deep px-7 text-base font-semibold text-sage-deep hover:bg-sage-tint',
  questions: 'mt-16 md:mt-24',
  questionsHeading: 'font-serif text-lg font-semibold text-sage-deep',
  question: 'mt-8 font-serif text-base font-semibold leading-snug',
  answer: 'mt-2 text-pretty leading-relaxed',
};

// Ids shared by the built HTML and the page, so client navigation does not add a second copy.
export const ORGANIZATION_JSON_LD_ID = 'sip-haven-organization-jsonld';
export const FAQ_JSON_LD_ID = 'sip-haven-faqpage-jsonld';
export const OUR_STORY_PRERENDER_ID = 'sip-haven-our-story-prerender';

// Already the hero line on the home page. Not a new claim.
export const SIP_HAVEN_SLOGAN = 'A little haven in every cup.';

/**
 * Organization and FAQPage for /our-story, in the shape Google's rich results expect
 * (one script each, @context and @type). Nothing here that the page or the repo does
 * not already state: no address, phone, logo, social link, price or rating.
 */
export function ourStoryStructuredData() {
  return {
    organization: {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Sip Haven',
      legalName: 'Sip Haven Co. LLC',
      url: DEFAULT_SITE_URL,
      description: PAGE_META['/our-story'].description,
      slogan: SIP_HAVEN_SLOGAN,
    },
    faqPage: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: OUR_STORY_FAQS.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    },
  };
}
