// What an email signup tells us about the shopper, and how it is written onto their
// Resend contact. /api/subscribe uses this; it lives here so the mapping can be tested
// on its own. Every optional field is checked and anything unknown is dropped, never
// refused: a signup with a bad extra must still go through.
//
// The contact properties (all strings) were created in Resend for this:
//   interest         'tea' | 'coffee' | 'both'                      fallback 'both'
//   signup_source    'quiz' | 'site'                                fallback 'site'
//   quiz_mood        a mood answer id from lib/quiz.js
//   quiz_caffeine    a caffeine answer id
//   quiz_flavor      a flavor answer id
//   quiz_aroma       an aroma answer id
//   quiz_style       a style answer id
//   quiz_top_match   the slug of the quiz's first pick (a product in the lineup)
//   quiz_matches     the slugs of every pick, best first, joined with commas
//                    ('lemon-sencha,jasmine-pearls'), so quiz_top_match is its first
import { getProduct } from './catalog.js';
import { MAX_RECOMMENDATIONS, cleanAnswers } from './quiz.js';

export const INTERESTS = ['tea', 'coffee', 'both'];
export const SOURCES = ['quiz', 'site'];

// The quiz's drink answer, as an interest.
const INTEREST_FOR_DRINK = { tea: 'tea', coffee: 'coffee', either: 'both' };

// The quiz answers stored on the contact, by property name.
const QUIZ_PROPERTIES = {
  quiz_mood: 'mood',
  quiz_caffeine: 'caffeine',
  quiz_flavor: 'flavor',
  quiz_aroma: 'aroma',
  quiz_style: 'style',
};

const oneOf = (options, value) => (options.includes(value) ? value : null);

// A slug of a product in the lineup, or null.
const lineupSlug = (value, data) =>
  typeof value === 'string' && getProduct(value, data) ? value : null;

// The valid slugs of a list of picks, in order, each once, at most MAX_RECOMMENDATIONS.
// Anything that is not a list, and any item that is not a slug in the lineup, is dropped.
function lineupSlugs(value, data) {
  if (!Array.isArray(value)) return [];
  const slugs = [];
  for (const item of value) {
    if (slugs.length === MAX_RECOMMENDATIONS) break;
    const slug = lineupSlug(item, data);
    if (slug && !slugs.includes(slug)) slugs.push(slug);
  }
  return slugs;
}

/**
 * The signup fields from a request body, checked:
 *   interest  from answers.drink when that is valid, else body.interest, else null
 *   source    'quiz' or 'site' ('site' when missing or unknown)
 *   answers   the valid quiz answers (see cleanAnswers), maybe {}
 *   matches   the slugs in body.matches that are in the lineup, best first, each once,
 *             at most MAX_RECOMMENDATIONS, maybe []
 *   topMatch  the first of matches, so the two always agree; with no matches,
 *             body.topMatch when it is a slug in the lineup; else null
 * `data` is the lineup, for tests.
 */
export function readSignup(body, data) {
  const answers = cleanAnswers(body?.answers);
  const matches = lineupSlugs(body?.matches, data);
  return {
    interest: INTEREST_FOR_DRINK[answers.drink] ?? oneOf(INTERESTS, body?.interest),
    source: oneOf(SOURCES, body?.source) ?? 'site',
    answers,
    topMatch: matches[0] ?? lineupSlug(body?.topMatch, data),
    matches,
  };
}

/**
 * The contact properties for a signup.
 *
 * `existing` is false for a new contact: it gets every property it has a value for,
 * with interest falling back to 'both'. For a contact that is already on the list
 * (`existing` true) only what this signup actually says is written, so a later signup
 * from a page that knows nothing (the footer on the home page, say) does not wipe out
 * an interest or quiz answers saved before. When the signup carries quiz answers, all
 * the quiz properties are written, and one with no value is cleared (null), so
 * re-taking the quiz replaces the old answers instead of mixing with them.
 */
export function contactProperties(signup, { existing = false } = {}) {
  const properties = { signup_source: signup.source };

  const interest = signup.interest ?? (existing ? null : 'both');
  if (interest) properties.interest = interest;

  const hasQuiz = Object.keys(signup.answers).length > 0 || signup.topMatch !== null;
  if (hasQuiz) {
    const quiz = {
      quiz_top_match: signup.topMatch,
      quiz_matches: signup.matches.length > 0 ? signup.matches.join(',') : null,
    };
    for (const [property, question] of Object.entries(QUIZ_PROPERTIES)) {
      quiz[property] = signup.answers[question] ?? null;
    }
    for (const [property, value] of Object.entries(quiz)) {
      // A new contact has nothing to clear.
      if (value !== null || existing) properties[property] = value;
    }
  }

  return properties;
}

/**
 * Which segments the contact belongs in, from its interest: tea for 'tea' and 'both',
 * coffee for 'coffee' and 'both'. `join` are the ones to add it to and `leave` the
 * ones to take it out of (only when the interest is one drink, so a shopper who now
 * says coffee leaves tea). No interest means no change at all.
 * @returns {{ join: ('tea' | 'coffee')[], leave: ('tea' | 'coffee')[] }}
 */
export function segmentsFor(interest) {
  if (interest === 'both') return { join: ['tea', 'coffee'], leave: [] };
  if (interest === 'tea') return { join: ['tea'], leave: ['coffee'] };
  if (interest === 'coffee') return { join: ['coffee'], leave: ['tea'] };
  return { join: [], leave: [] };
}
