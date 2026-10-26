// Approved copy for /our-story. The page (src/pages/OurStory.jsx) and the built
// our-story.html (lib/our-story-html.js) both read these words, so a crawler that
// does not run JavaScript sees the same story as a visitor.
import { DEFAULT_SITE_URL } from '../../lib/site-url.js';
import { PAGE_META } from './pageMeta.js';

// The approved story, split so the page can give each part its own pace. Joining a
// block with a space rebuilds the paragraph Joseph approved. The three `label`
// values are the only words added for the layout.
export const OUR_STORY_EYEBROW = 'Our story';

export const OUR_STORY_HEADLINE = 'Sip Haven is a place to slow down and remember.';

export const OUR_STORY_INTRO =
  "Life is a sum of all your experiences. Most days we're too busy living them to notice.";

export const OUR_STORY_QUOTE =
  'A good cup gives you a reason to stop, take a breath and let it all catch up with you.';

export const OUR_STORY_SECTIONS = [
  {
    label: 'A quiet corner',
    text: "That's what we want Sip Haven to feel like: a quiet corner where the kettle is always on and there's time to look back.",
    moments: [
      'A mug of coffee before the house wakes up, thinking about yesterday.',
      'A pot of loose-leaf tea on a Sunday afternoon, remembering a trip, an old friend or a moment you almost forgot.',
    ],
  },
  {
    label: 'Why tea and coffee',
    text: "We love tea and coffee for the same reason. Both turn an ordinary moment into a little ritual, and the best rituals leave you grateful for how far you've come.",
  },
  {
    label: "What we're brewing",
    text: "We're building a collection of loose-leaf tea, tea bags, tea K-Cups, and whole bean and ground coffee for those pauses. Pull up a chair, pour a cup and take a look around.",
  },
];

export const OUR_STORY_CTA = {
  prompt: 'Not sure where to start?',
  link: "Try the quiz and we'll point you toward a cup you might like.",
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
// Text blocks use max-w-prose (65 characters) so a line stays in the 60 to 70 range.
export const STORY_CLASS = {
  page: 'mx-auto w-full max-w-3xl px-4 py-14 md:py-20',
  measure: 'mx-auto max-w-prose',
  hero: 'mx-auto max-w-prose text-center',
  eyebrow: 'text-xs font-semibold uppercase tracking-wider text-sage-deep',
  headline: 'mt-3 text-balance font-serif text-4xl font-semibold leading-tight text-sage-deep md:text-5xl',
  intro: 'mt-6 text-pretty text-xl leading-relaxed',
  quote: 'mx-auto my-16 max-w-prose border-y border-wood py-10 text-balance text-center font-serif text-2xl leading-snug text-sage-deep md:my-24 md:py-14 md:text-3xl',
  section: 'mt-16 md:mt-24',
  label: 'font-sans text-xs font-semibold uppercase tracking-wider text-sage-deep',
  body: 'mt-4 text-pretty text-lg leading-relaxed',
  moments: 'mt-8 grid gap-6 border-t border-wood pt-8 md:grid-cols-2 md:gap-0 md:divide-x md:divide-wood',
  momentFirst: 'text-pretty text-lg leading-relaxed md:pr-8',
  momentSecond: 'border-t border-wood pt-6 text-pretty text-lg leading-relaxed md:border-t-0 md:pt-0 md:pl-8',
  cta: 'mt-16 rounded-3xl bg-sage-tint px-6 py-10 text-center md:mt-24 md:px-12 md:py-14',
  ctaPrompt: 'text-balance font-serif text-2xl font-semibold text-sage-deep md:text-3xl',
  ctaLink: 'mx-auto mt-6 inline-flex w-full max-w-md items-center justify-center rounded-3xl bg-sage-deep px-7 py-4 text-center text-base font-semibold leading-snug text-cream hover:bg-ink',
  question: 'mt-8 font-serif text-xl font-semibold leading-snug text-sage-deep',
  answer: 'mt-3 text-pretty text-lg leading-relaxed',
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
