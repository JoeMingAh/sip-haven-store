// Approved copy for /our-story. The page (src/pages/OurStory.jsx) and the built
// our-story.html (lib/our-story-html.js) both read these words, so a crawler that
// does not run JavaScript sees the same story as a visitor.
import { DEFAULT_SITE_URL } from '../../lib/site-url.js';
import { PAGE_META } from './pageMeta.js';

export const OUR_STORY_TITLE = 'Our story';

export const OUR_STORY_LEAD = 'Sip Haven is a place to slow down and remember.';

export const OUR_STORY_PARAGRAPHS = [
  "Life is a sum of all your experiences. Most days we're too busy living them to notice. A good cup gives you a reason to stop, take a breath and let it all catch up with you.",
  "That's what we want Sip Haven to feel like: a quiet corner where the kettle is always on and there's time to look back. A mug of coffee before the house wakes up, thinking about yesterday. A pot of loose-leaf tea on a Sunday afternoon, remembering a trip, an old friend or a moment you almost forgot.",
  "We love tea and coffee for the same reason. Both turn an ordinary moment into a little ritual, and the best rituals leave you grateful for how far you've come.",
  "We're building a collection of loose-leaf tea, tea bags, tea K-Cups, and whole bean and ground coffee for those pauses. Pull up a chair, pour a cup and take a look around.",
];

// "the quiz" is the link to /quiz. The sentence on the page is before + link + after.
export const OUR_STORY_QUIZ = {
  before: 'Not sure where to start? Try ',
  link: 'the quiz',
  after: " and we'll point you toward a cup you might like.",
};

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

// The same classes the React page uses, so the static copy is styled if it shows.
export const STORY_CLASS = {
  page: 'mx-auto max-w-prose px-4 py-10 md:py-14',
  image: 'h-16 w-16',
  title: 'mt-4 text-balance font-serif text-4xl font-semibold leading-tight text-sage-deep md:text-5xl',
  lead: 'mt-4 text-pretty font-serif text-2xl leading-snug',
  body: 'mt-5 text-pretty text-lg leading-relaxed',
  section: 'mt-10 font-serif text-2xl font-semibold text-sage-deep',
  question: 'mt-8 font-serif text-xl font-semibold text-sage-deep',
  link: 'font-semibold text-sage-deep underline underline-offset-4 hover:no-underline',
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
