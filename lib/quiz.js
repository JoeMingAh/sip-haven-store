// The "find your cup" quiz: its questions, and the scoring that turns a shopper's
// answers into up to three picks from the lineup. Plain functions and data with no
// React in them, so the quiz page and the Node tests share the same code. The
// questions live here, beside the scoring, so the two cannot drift apart: each answer
// says what it looks for, and recommend() is the only code that reads those fields.
//
// `answers` is { [question id]: answer id }, like
//   { drink: 'tea', caffeine: 'none', flavor: 'floral', style: 'ritual' }
// A question that is missing, or an id that is not one of its answers, means no
// preference.
//
// What an answer can ask for (each is optional; "either" answers ask for nothing):
//   category  'tea' | 'coffee'      a filter: a product in another category is out
//   caffeine  'none' ... 'high'     scored: the product has exactly this caffeine level;
//                                   'none' is also a filter: a product with caffeine is out
//   tags      string[]              scored: the product has at least one of these tags
//   formats   string[]              scored: a variant that can be bought has one of these
//
// The flavor answers look at a product's `tags`, so a product is only found by them if
// its tags (the "tags" column of the lineup) include one of the words listed below.
//
// SCORING. Out before any points are counted: a product that cannot be bought (no
// variant has a stripe_price_id), a product in another category than the one the
// shopper chose (no filter for "either"), and, for a shopper who chose caffeine-free,
// every product that is not caffeine-free (one with no caffeine level on record too).
// Caffeine-free is a promise, not a preference, so no flavor or format match can bring
// such a product back; every other caffeine level only scores. A product that is left
// earns points for each answer it matches:
//   caffeine  4   its caffeine level is the one chosen
//   flavor    2   it has at least one tag from the chosen flavor family
//   style     1   a variant that can be bought comes in one of the chosen formats
// Each answer counts once, however many tags or variants match. The weights are powers
// of two, so a match on a more important answer always beats any mix of matches on the
// ones below it: caffeine, then flavor, then style. A product that earns no points
// matches nothing the shopper asked for and is not a pick. Best score first, and
// products with the same score stay in lineup order.
import { CAFFEINE_LABELS, FORMAT_LABELS } from './filter.js';
import { purchasableVariants } from './catalog.js';

const CAFFEINE_POINTS = 4;
const FLAVOR_POINTS = 2;
const STYLE_POINTS = 1;

/** The most products the quiz recommends. */
export const MAX_RECOMMENDATIONS = 3;

// "K-Cup, Tea bags, Ground": formats in the shop's own words, as the filters say them.
const formatNames = (formats) => formats.map((format) => FORMAT_LABELS[format]).join(', ');

const caffeineAnswer = (level, hint) => ({
  id: level,
  label: CAFFEINE_LABELS[level],
  hint,
  caffeine: level,
});

const QUICK_FORMATS = ['k-cup', 'tea-bags', 'ground'];
const RITUAL_FORMATS = ['loose-leaf', 'whole-bean'];

// DRAFT COPY: the wording of the questions and answers needs Joseph's approval.
//
// The questions, in the order they are asked. `hint` is a line under the answer.
export const QUIZ_QUESTIONS = [
  {
    id: 'drink',
    prompt: 'What are you in the mood for?',
    answers: [
      { id: 'tea', label: 'Tea', category: 'tea' },
      { id: 'coffee', label: 'Coffee', category: 'coffee' },
      { id: 'either', label: 'Either one', hint: 'Show me both' },
    ],
  },
  {
    id: 'caffeine',
    prompt: 'How much caffeine would you like?',
    answers: [
      caffeineAnswer('none', 'Nothing to keep me up'),
      caffeineAnswer('low', 'Just a gentle lift'),
      caffeineAnswer('medium', 'A steady everyday boost'),
      caffeineAnswer('high', 'Bring on the energy'),
    ],
  },
  {
    id: 'flavor',
    prompt: 'Which flavors sound best?',
    answers: [
      { id: 'floral', label: 'Floral', hint: 'Blossoms and soft fragrance', tags: ['floral'] },
      { id: 'fruity', label: 'Fruity', hint: 'Bright, juicy and fresh', tags: ['fruity', 'fruit'] },
      { id: 'earthy', label: 'Earthy', hint: 'Deep, toasty and grounded', tags: ['earthy'] },
      {
        id: 'sweet-spiced',
        label: 'Sweet and spiced',
        hint: 'Warm, cozy and a little dessert-like',
        tags: ['sweet', 'spiced', 'spicy'],
      },
    ],
  },
  {
    id: 'style',
    prompt: 'How do you like to make your cup?',
    answers: [
      {
        id: 'quick',
        label: 'Quick and easy',
        hint: formatNames(QUICK_FORMATS),
        formats: QUICK_FORMATS,
      },
      {
        id: 'ritual',
        label: 'A slow ritual',
        hint: formatNames(RITUAL_FORMATS),
        formats: RITUAL_FORMATS,
      },
      { id: 'either', label: 'Either way is fine', hint: 'No preference' },
    ],
  },
];

const asList = (value) => (Array.isArray(value) ? value : []);

// "Floral " and "floral" are the same tag.
const tagKey = (tag) => (typeof tag === 'string' ? tag.trim().toLowerCase() : '');

// What the shopper asked for, read off the answers they gave: the answer objects
// above, found by id (so an unknown id, or one that is only an object property name,
// is simply not found), folded into one set of wishes.
function wishesFrom(answers) {
  const picked = QUIZ_QUESTIONS.map((question) =>
    question.answers.find((option) => option.id === answers?.[question.id]),
  ).filter(Boolean);
  const first = (field) => picked.map((option) => option[field]).find((value) => value != null) ?? null;

  return {
    category: first('category'),
    caffeine: first('caffeine'),
    tags: new Set(picked.flatMap((option) => asList(option.tags)).map(tagKey)),
    formats: new Set(picked.flatMap((option) => asList(option.formats))),
  };
}

// The points a product earns, from the answers it matches. `buyable` is its variants
// that can be bought: a format only counts if the shopper could actually order it.
function pointsFor(product, buyable, wishes) {
  let points = 0;
  if (wishes.caffeine !== null && product.caffeine === wishes.caffeine) {
    points += CAFFEINE_POINTS;
  }
  if (wishes.tags.size > 0 && asList(product.tags).some((tag) => wishes.tags.has(tagKey(tag)))) {
    points += FLAVOR_POINTS;
  }
  if (wishes.formats.size > 0 && buyable.some((variant) => wishes.formats.has(variant.format))) {
    points += STYLE_POINTS;
  }
  return points;
}

/**
 * Up to MAX_RECOMMENDATIONS of `products` that suit these answers, best first. Only
 * products that can be bought, in the chosen category, with no caffeine if the shopper
 * chose caffeine-free, that match at least one other answer; see SCORING at the top of
 * this file. Always a new array of the products themselves, and `[]` when nothing
 * matches.
 */
export function recommend(answers, products) {
  const wishes = wishesFrom(answers);

  // purchasableVariants gives [] for anything that is not a product with variants (a
  // hole in the list, say), so those drop out at the first filter below.
  return asList(products)
    .map((product) => ({ product, buyable: purchasableVariants(product) }))
    .filter(
      ({ product, buyable }) =>
        buyable.length > 0 &&
        (wishes.category === null || product.category === wishes.category) &&
        (wishes.caffeine !== 'none' || product.caffeine === 'none'),
    )
    .map(({ product, buyable }) => ({ product, points: pointsFor(product, buyable, wishes) }))
    .filter(({ points }) => points > 0)
    .sort((a, b) => b.points - a.points) // Array.prototype.sort is stable, so ties keep their order.
    .slice(0, MAX_RECOMMENDATIONS)
    .map(({ product }) => product);
}

/**
 * What to tell the signup list the shopper is interested in: the category they chose
 * ('tea' or 'coffee'), or 'both' when they said either or have not said.
 * @returns {'tea' | 'coffee' | 'both'}
 */
export function interestFor(answers) {
  return wishesFrom(answers).category ?? 'both';
}
