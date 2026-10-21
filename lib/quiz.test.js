import { describe, it, expect } from 'vitest';
import { CAFFEINE_LABELS, FORMAT_LABELS } from './filter.js';
import {
  MAX_RECOMMENDATIONS,
  QUIZ_AROMAS,
  QUIZ_QUESTIONS,
  cleanAnswers,
  interestFor,
  recommend,
} from './quiz.js';

const variant = (overrides = {}) => ({
  id: 'loose-leaf-2oz',
  format: 'loose-leaf',
  size_label: '2 oz',
  price_cents: 1800,
  stripe_price_id: 'price_1',
  ...overrides,
});

// By default a tea with low caffeine, no tags and one format (tea bags) that none of
// the answers below ask for, so a test only gives a product what it means to match.
const item = (slug, overrides = {}) => ({
  slug,
  name: slug,
  category: 'tea',
  caffeine: 'low',
  tags: [],
  variants: [variant({ id: 'tea-bags-15', format: 'tea-bags' })],
  ...overrides,
});

const slugs = (products) => products.map((product) => product.slug);

// A product that can be bought, in one format.
const sold = (format) => [variant({ id: `${format}-1`, format })];

// "tea + none + floral + ritual", the example from the brief.
const TEA_NONE_FLORAL_RITUAL = {
  drink: 'tea',
  caffeine: 'none',
  flavor: 'floral',
  style: 'ritual',
};

const question = (id) => QUIZ_QUESTIONS.find((candidate) => candidate.id === id);
const answerOf = (questionId, answerId) =>
  question(questionId).answers.find((candidate) => candidate.id === answerId);

describe('QUIZ_QUESTIONS', () => {
  it('has five questions: drink, caffeine, flavor, aroma and style, in that order', () => {
    expect(QUIZ_QUESTIONS.map((entry) => entry.id)).toEqual([
      'drink',
      'caffeine',
      'flavor',
      'aroma',
      'style',
    ]);
  });

  it('offers three to six answers to each question', () => {
    for (const entry of QUIZ_QUESTIONS) {
      expect(entry.answers.length, entry.id).toBeGreaterThanOrEqual(3);
      expect(entry.answers.length, entry.id).toBeLessThanOrEqual(6);
    }
  });

  it('asks "Which aroma pulls you in?" right after flavor', () => {
    const ids = QUIZ_QUESTIONS.map((entry) => entry.id);
    expect(ids.indexOf('aroma')).toBe(ids.indexOf('flavor') + 1);
    expect(question('aroma').prompt).toBe('Which aroma pulls you in?');
  });

  it('maps the aroma answers to the aroma families from the brief', () => {
    const families = Object.fromEntries(
      question('aroma').answers.map((option) => [option.id, [option.label, option.aromas ?? []]]),
    );
    expect(families).toEqual({
      floral: ['Floral', ['jasmine', 'rose', 'lavender', 'orchid']],
      toasty: ['Toasty and smoky', ['smoky', 'roasted', 'nutty', 'cocoa']],
      citrus: ['Bright and citrusy', ['citrus', 'lemon', 'bergamot', 'berry']],
      sweet: ['Sweet', ['vanilla', 'caramel', 'honey', 'malty']],
      fresh: ['Fresh and herbal', ['grassy', 'mint', 'herbal', 'ocean']],
      either: ['Surprise me', []],
    });
  });

  it('gives each aroma family words that are lowercase, trimmed and not shared with another', () => {
    const seen = new Map();
    for (const option of question('aroma').answers) {
      for (const aroma of option.aromas ?? []) {
        expect(aroma, `${option.id} aroma`).toBe(aroma.trim().toLowerCase());
        expect(seen.get(aroma), `${aroma} is in two families`).toBeUndefined();
        seen.set(aroma, option.id);
      }
    }
  });

  it('lists every aroma word in QUIZ_AROMAS, in quiz order', () => {
    expect(QUIZ_AROMAS).toEqual(question('aroma').answers.flatMap((option) => option.aromas ?? []));
    expect(QUIZ_AROMAS).toHaveLength(20);
  });

  it('gives every question a prompt and every answer a label', () => {
    for (const entry of QUIZ_QUESTIONS) {
      expect(entry.prompt.trim(), `${entry.id} prompt`).not.toBe('');
      for (const option of entry.answers) {
        expect(option.label.trim(), `${entry.id}/${option.id} label`).not.toBe('');
      }
    }
  });

  it('gives the questions, and the answers within a question, ids of their own', () => {
    const questionIds = QUIZ_QUESTIONS.map((entry) => entry.id);
    expect(new Set(questionIds).size).toBe(questionIds.length);
    for (const entry of QUIZ_QUESTIONS) {
      const answerIds = entry.answers.map((option) => option.id);
      expect(new Set(answerIds).size, entry.id).toBe(answerIds.length);
    }
  });

  it('maps the drink answers to a category, and "either" to none', () => {
    expect(answerOf('drink', 'tea').category).toBe('tea');
    expect(answerOf('drink', 'coffee').category).toBe('coffee');
    expect(answerOf('drink', 'either').category ?? null).toBeNull();
    expect(question('drink').answers).toHaveLength(3);
  });

  it('maps the caffeine answers to none, low, medium and high, worded as the shop filters are', () => {
    expect(question('caffeine').answers.map((option) => option.caffeine)).toEqual([
      'none',
      'low',
      'medium',
      'high',
    ]);
    for (const option of question('caffeine').answers) {
      expect(option.label).toBe(CAFFEINE_LABELS[option.caffeine]);
    }
  });

  it('maps floral, fruity, earthy and sweet/spiced to the tags that stand for them', () => {
    expect(question('flavor').answers.map((option) => option.id)).toEqual([
      'floral',
      'fruity',
      'earthy',
      'sweet-spiced',
    ]);
    expect(answerOf('flavor', 'floral').tags).toContain('floral');
    expect(answerOf('flavor', 'fruity').tags).toContain('fruity');
    expect(answerOf('flavor', 'earthy').tags).toContain('earthy');
    expect(answerOf('flavor', 'sweet-spiced').tags).toEqual(expect.arrayContaining(['sweet', 'spiced']));
  });

  it('gives each flavor family tags that are lowercase, trimmed and not shared with another family', () => {
    const seen = new Map();
    for (const option of question('flavor').answers) {
      expect(option.tags.length, option.id).toBeGreaterThan(0);
      for (const tag of option.tags) {
        expect(tag, `${option.id} tag`).toBe(tag.trim().toLowerCase());
        expect(seen.get(tag), `${tag} is in two families`).toBeUndefined();
        seen.set(tag, option.id);
      }
    }
  });

  it('maps quick to k-cup, tea bags and ground, and ritual to loose leaf and whole bean', () => {
    expect(answerOf('style', 'quick').formats).toEqual(['k-cup', 'tea-bags', 'ground']);
    expect(answerOf('style', 'ritual').formats).toEqual(['loose-leaf', 'whole-bean']);
  });

  it('has a third style answer that names no format, so it prefers none', () => {
    expect(question('style').answers).toHaveLength(3);
    expect(answerOf('style', 'either')).toBeDefined();
    expect(answerOf('style', 'either').formats ?? []).toEqual([]);
  });

  it('only names formats the shop sells, and says them in the shop\'s own words', () => {
    for (const option of question('style').answers) {
      for (const format of option.formats ?? []) {
        expect(Object.keys(FORMAT_LABELS), `${option.id}: ${format}`).toContain(format);
        expect(option.hint, `${option.id} hint`).toContain(FORMAT_LABELS[format]);
      }
    }
  });
});

describe('recommend', () => {
  it('ranks a loose-leaf floral herbal tea first for tea + none + floral + ritual', () => {
    const lineup = [
      item('breakfast-black', {
        caffeine: 'high',
        tags: ['black', 'malty'],
        variants: sold('tea-bags'),
      }),
      item('rose-herbal-bags', {
        caffeine: 'none',
        tags: ['herbal', 'floral'],
        variants: sold('tea-bags'),
      }),
      item('chamomile-loose', {
        caffeine: 'none',
        tags: ['herbal', 'floral'],
        variants: sold('loose-leaf'),
      }),
      item('mint-loose', {
        caffeine: 'none',
        tags: ['herbal', 'minty'],
        variants: sold('loose-leaf'),
      }),
      item('jasmine-green', {
        caffeine: 'low',
        tags: ['green', 'floral'],
        variants: sold('loose-leaf'),
      }),
    ];

    const picks = recommend(TEA_NONE_FLORAL_RITUAL, lineup);

    expect(picks[0].slug).toBe('chamomile-loose');
    // Then caffeine + flavor, then caffeine + style. The black tea and the green tea have
    // caffeine, so they are out for a caffeine-free shopper, though the green tea fits the
    // flavor and the format.
    expect(slugs(picks)).toEqual(['chamomile-loose', 'rose-herbal-bags', 'mint-loose']);
  });

  it('never returns a product that cannot be bought', () => {
    const lineup = [
      item('not-synced', {
        caffeine: 'none',
        tags: ['floral'],
        variants: [variant({ stripe_price_id: undefined })],
      }),
      item('blank-price-id', {
        caffeine: 'none',
        tags: ['floral'],
        variants: [variant({ stripe_price_id: '' })],
      }),
      item('spaces-price-id', {
        caffeine: 'none',
        tags: ['floral'],
        variants: [variant({ stripe_price_id: '   ' })],
      }),
      item('no-variants', { caffeine: 'none', tags: ['floral'], variants: [] }),
      item('no-variants-field', { caffeine: 'none', tags: ['floral'], variants: undefined }),
      item('for-sale', { caffeine: 'none', tags: ['floral'] }),
    ];
    expect(slugs(recommend(TEA_NONE_FLORAL_RITUAL, lineup))).toEqual(['for-sale']);
  });

  it('returns nothing for an empty lineup', () => {
    expect(recommend(TEA_NONE_FLORAL_RITUAL, [])).toEqual([]);
  });

  it('copes with a lineup that is missing, not a list, or has holes in it', () => {
    expect(recommend(TEA_NONE_FLORAL_RITUAL, undefined)).toEqual([]);
    expect(recommend(TEA_NONE_FLORAL_RITUAL, null)).toEqual([]);
    expect(recommend(TEA_NONE_FLORAL_RITUAL, { products: [] })).toEqual([]);
    const good = item('good', { caffeine: 'none' });
    expect(recommend(TEA_NONE_FLORAL_RITUAL, [null, undefined, 'tea', good])).toEqual([good]);
  });

  describe('category', () => {
    // A coffee that matches everything else, and a tea that matches one answer.
    const lineup = [
      item('perfect-coffee', {
        category: 'coffee',
        caffeine: 'none',
        tags: ['floral'],
        variants: sold('whole-bean'),
      }),
      item('plain-tea', { caffeine: 'none' }),
    ];

    it('is a hard filter: tea returns only teas, however well a coffee scores', () => {
      expect(slugs(recommend(TEA_NONE_FLORAL_RITUAL, lineup))).toEqual(['plain-tea']);
    });

    it('is a hard filter: coffee returns only coffees', () => {
      const picks = recommend({ ...TEA_NONE_FLORAL_RITUAL, drink: 'coffee' }, lineup);
      expect(slugs(picks)).toEqual(['perfect-coffee']);
    });

    it('is no filter at all for "either", which ranks teas and coffees together', () => {
      const picks = recommend({ ...TEA_NONE_FLORAL_RITUAL, drink: 'either' }, lineup);
      expect(slugs(picks)).toEqual(['perfect-coffee', 'plain-tea']);
    });

    it('returns nothing when the category has nothing that can be bought', () => {
      const teasOnly = [item('a-tea', { caffeine: 'none', tags: ['floral'] })];
      expect(recommend({ ...TEA_NONE_FLORAL_RITUAL, drink: 'coffee' }, teasOnly)).toEqual([]);
    });
  });

  describe('caffeine-free', () => {
    // "None" is a promise, not a preference: the shopper wants nothing with caffeine in
    // it, so a product with any is out however well its flavor and format fit. The other
    // levels only add points.
    const decaf = { drink: 'either', caffeine: 'none', flavor: 'floral', style: 'ritual' };

    it('leaves out a caffeinated product that fits the flavor and the format perfectly', () => {
      const lineup = [
        // Floral and loose leaf, so it would score 4 + 1 if caffeine only added points.
        item('jasmine-green', { caffeine: 'low', tags: ['floral'], variants: sold('loose-leaf') }),
        item('plain-herbal', { caffeine: 'none' }),
      ];
      expect(slugs(recommend(decaf, lineup))).toEqual(['plain-herbal']);
    });

    it.each(['low', 'medium', 'high'])('leaves out a product with %s caffeine', (level) => {
      const lineup = [
        item('caffeinated', { caffeine: level, tags: ['floral'], variants: sold('loose-leaf') }),
      ];
      expect(recommend(decaf, lineup)).toEqual([]);
    });

    it('returns nothing, not a caffeinated pick, when no caffeine-free product can be bought', () => {
      const lineup = [
        item('green', { caffeine: 'low', tags: ['floral'], variants: sold('loose-leaf') }),
        item('black', { caffeine: 'high', tags: ['floral'], variants: sold('loose-leaf') }),
        item('herbal-not-synced', {
          caffeine: 'none',
          tags: ['floral'],
          variants: [variant({ stripe_price_id: undefined })],
        }),
      ];
      expect(recommend(decaf, lineup)).toEqual([]);
    });

    it('leaves out a product whose caffeine level is not on record', () => {
      const lineup = [
        { slug: 'bare', category: 'tea', tags: ['floral'], variants: sold('loose-leaf') },
      ];
      expect(recommend(decaf, lineup)).toEqual([]);
    });

    it('applies to coffee too, and across both categories for "either"', () => {
      const lineup = [
        item('dawn-roast', {
          category: 'coffee',
          caffeine: 'high',
          tags: ['floral'],
          variants: sold('whole-bean'),
        }),
        item('swiss-decaf', { category: 'coffee', caffeine: 'none', variants: sold('ground') }),
      ];
      expect(slugs(recommend(decaf, lineup))).toEqual(['swiss-decaf']);
    });

    it('still ranks what is left by flavor and format', () => {
      const lineup = [
        item('plain', { caffeine: 'none' }), // 8
        item('floral-loose', { caffeine: 'none', tags: ['floral'], variants: sold('loose-leaf') }), // 13
        item('floral-green', { caffeine: 'low', tags: ['floral'], variants: sold('loose-leaf') }), // out
        item('floral', { caffeine: 'none', tags: ['floral'] }), // 12
      ];
      expect(slugs(recommend(decaf, lineup))).toEqual(['floral-loose', 'floral', 'plain']);
    });

    it('is a filter for "none" only: any other level still just adds points', () => {
      const lineup = [
        item('low-tea', { caffeine: 'low' }), // the caffeine asked for: 8
        item('decaf-floral', { caffeine: 'none', tags: ['floral'] }), // not that level, but floral: 4
      ];
      const low = { drink: 'either', caffeine: 'low', flavor: 'floral' };
      expect(slugs(recommend(low, lineup))).toEqual(['low-tea', 'decaf-floral']);
    });
  });

  describe('scoring', () => {
    // Medium caffeine, which the default item (low) does not match, so a test gives a
    // product only the matches it means to. "None" is left out on purpose: it is a filter
    // as well as a score (see "caffeine-free" below), and would leave out the default item.
    const answers = { drink: 'either', caffeine: 'medium', flavor: 'floral', style: 'ritual' };

    it('counts a matching caffeine level, and only an exact one', () => {
      const lineup = [
        item('none', { caffeine: 'none' }),
        item('low', { caffeine: 'low' }),
        item('medium', { caffeine: 'medium' }),
        item('high', { caffeine: 'high' }),
      ];
      expect(slugs(recommend(answers, lineup))).toEqual(['medium']);
    });

    it('counts a tag from the chosen flavor family', () => {
      const lineup = [
        item('fruity', { tags: ['fruity'] }),
        item('floral', { tags: ['floral'] }),
        item('no-tags', { tags: [] }),
      ];
      expect(slugs(recommend(answers, lineup))).toEqual(['floral']);
    });

    it('counts a chosen format on a variant that can be bought', () => {
      const lineup = [
        item('bags', { variants: sold('tea-bags') }),
        item('loose', { variants: sold('loose-leaf') }),
        item('beans', { category: 'coffee', variants: sold('whole-bean') }),
      ];
      expect(slugs(recommend(answers, lineup))).toEqual(['loose', 'beans']);
    });

    it('ignores a format that is only on a variant not yet synced to Stripe', () => {
      const lineup = [
        // Can be bought as tea bags; its loose leaf is not for sale yet, so it matches nothing.
        item('loose-not-synced', {
          variants: [
            variant({ id: 'bags', format: 'tea-bags' }),
            variant({ id: 'loose', format: 'loose-leaf', stripe_price_id: undefined }),
          ],
        }),
        item('loose-synced', { variants: sold('loose-leaf') }),
      ];
      expect(slugs(recommend(answers, lineup))).toEqual(['loose-synced']);
    });

    it('weighs caffeine over flavor and style together', () => {
      const lineup = [
        item('flavor-and-style', { tags: ['floral'], variants: sold('loose-leaf') }), // 4 + 1
        item('caffeine-only', { caffeine: 'medium' }), // 8
      ];
      expect(slugs(recommend(answers, lineup))).toEqual(['caffeine-only', 'flavor-and-style']);
    });

    it('weighs flavor over style', () => {
      const lineup = [
        item('style-only', { variants: sold('loose-leaf') }), // 1
        item('flavor-only', { tags: ['floral'] }), // 4
      ];
      expect(slugs(recommend(answers, lineup))).toEqual(['flavor-only', 'style-only']);
    });

    describe('aroma', () => {
      // The answers above, plus a citrus aroma.
      const citrus = { ...answers, aroma: 'citrus' };

      it('counts an aroma from the chosen aroma family', () => {
        const lineup = [
          item('smoky', { aromas: ['smoky'] }),
          item('bergamot', { aromas: ['bergamot'] }),
          item('no-aromas', { aromas: [] }),
        ];
        expect(slugs(recommend(citrus, lineup))).toEqual(['bergamot']);
      });

      it('breaks a tie on caffeine and flavor', () => {
        const lineup = [
          // Both medium and floral (8 + 4); only the second smells of citrus (+ 2).
          item('floral-rose', { caffeine: 'medium', tags: ['floral'], aromas: ['rose'] }),
          item('floral-lemon', { caffeine: 'medium', tags: ['floral'], aromas: ['lemon'] }),
        ];
        expect(slugs(recommend(citrus, lineup))).toEqual(['floral-lemon', 'floral-rose']);
      });

      it('weighs flavor over aroma and style together', () => {
        const lineup = [
          item('aroma-and-style', { aromas: ['citrus'], variants: sold('loose-leaf') }), // 2 + 1
          item('flavor-only', { tags: ['floral'] }), // 4
        ];
        expect(slugs(recommend(citrus, lineup))).toEqual(['flavor-only', 'aroma-and-style']);
      });

      it('weighs aroma over style', () => {
        const lineup = [
          item('style-only', { variants: sold('loose-leaf') }), // 1
          item('aroma-only', { aromas: ['berry'] }), // 2
        ];
        expect(slugs(recommend(citrus, lineup))).toEqual(['aroma-only', 'style-only']);
      });

      it('weighs caffeine over flavor, aroma and style together', () => {
        const lineup = [
          item('the-rest', { tags: ['floral'], aromas: ['citrus'], variants: sold('loose-leaf') }), // 7
          item('caffeine-only', { caffeine: 'medium' }), // 8
        ];
        expect(slugs(recommend(citrus, lineup))).toEqual(['caffeine-only', 'the-rest']);
      });

      it('does not mix up flavor tags and aromas', () => {
        // 'citrus' as a tag is not a citrus aroma, and 'floral' as an aroma is not a
        // floral flavor (the floral aromas are jasmine, rose, lavender and orchid).
        const lineup = [
          item('citrus-tag', { tags: ['citrus'] }),
          item('floral-aroma', { aromas: ['floral'] }),
        ];
        expect(recommend({ drink: 'tea', flavor: 'floral', aroma: 'citrus' }, lineup)).toEqual([]);
      });

      it('gives "Surprise me" no points: it prefers no aroma', () => {
        const lineup = [item('lemon', { aromas: ['lemon'] })];
        expect(recommend({ drink: 'tea', aroma: 'either' }, lineup)).toEqual([]);
      });

      it('matches aromas without regard to case or spacing, and copes with odd ones', () => {
        const lineup = [
          item('shouty', { aromas: ['  LEMON '] }),
          item('odd', { aromas: [null, 7, '', 'berry'] }),
          item('not-a-list', { aromas: 'lemon' }),
          { slug: 'bare', category: 'tea', caffeine: 'low', variants: sold('tea-bags') },
        ];
        expect(slugs(recommend({ drink: 'tea', aroma: 'citrus' }, lineup))).toEqual(['shouty', 'odd']);
      });
    });

    it('picks, from a test lineup, the product whose tags and aromas best fit the answers', () => {
      const lineup = [
        item('smoky-oolong', { caffeine: 'medium', tags: ['earthy'], aromas: ['smoky', 'roasted'] }),
        item('earl-grey', { caffeine: 'high', tags: ['floral', 'fruity'], aromas: ['bergamot'] }),
        item('lemon-sencha', {
          caffeine: 'medium',
          tags: ['fruity', 'grassy'],
          aromas: ['lemon', 'grassy'],
          variants: sold('loose-leaf'),
        }),
        item('berry-hibiscus', { caffeine: 'none', tags: ['fruity'], aromas: ['berry'] }),
        item('jasmine-pearls', { caffeine: 'medium', tags: ['floral'], aromas: ['jasmine'] }),
      ];
      const fruityCitrus = {
        drink: 'tea',
        caffeine: 'medium',
        flavor: 'fruity',
        aroma: 'citrus',
        style: 'ritual',
      };
      // lemon-sencha: 8 + 4 + 2 + 1 = 15. jasmine-pearls and smoky-oolong: caffeine only,
      // 8. earl-grey: fruity and bergamot, 4 + 2. berry-hibiscus: fruity and berry, 4 + 2.
      expect(slugs(recommend(fruityCitrus, lineup))).toEqual([
        'lemon-sencha',
        'smoky-oolong',
        'jasmine-pearls',
      ]);
    });

    it('adds the points up: all three beats any two', () => {
      const lineup = [
        item('caffeine-and-flavor', { caffeine: 'medium', tags: ['floral'] }),
        item('all-three', { caffeine: 'medium', tags: ['floral'], variants: sold('loose-leaf') }),
        item('caffeine-and-style', { caffeine: 'medium', variants: sold('loose-leaf') }),
      ];
      expect(slugs(recommend(answers, lineup))).toEqual([
        'all-three',
        'caffeine-and-flavor',
        'caffeine-and-style',
      ]);
    });

    it('keeps the lineup order between products with the same score', () => {
      const lineup = [
        item('c', { caffeine: 'medium' }),
        item('a', { caffeine: 'medium' }),
        item('b', { caffeine: 'medium' }),
      ];
      expect(slugs(recommend(answers, lineup))).toEqual(['c', 'a', 'b']);
    });

    it('counts a match once however many tags, aromas or variants it matches on', () => {
      const quickSweet = {
        drink: 'tea',
        caffeine: 'medium',
        flavor: 'sweet-spiced',
        aroma: 'sweet',
        style: 'quick',
      };
      const lineup = [
        // Both family tags, two family aromas and both formats match, but each answer
        // scores once: 4 + 2 + 1 = 7, which is less than caffeine alone (8). Counted per
        // tag it would be 8 + 2 + 1 = 11, per aroma 4 + 4 + 1 = 9, and per variant
        // 4 + 2 + 2 = 8, a tie that this product, first in the lineup, wins.
        item('many', {
          tags: ['sweet', 'spiced'],
          aromas: ['vanilla', 'caramel'],
          variants: [...sold('tea-bags'), ...sold('k-cup')],
        }),
        // Loose leaf is not a quick format, so this scores caffeine and nothing else.
        item('caffeine-only', { caffeine: 'medium', variants: sold('loose-leaf') }),
      ];
      expect(slugs(recommend(quickSweet, lineup))).toEqual(['caffeine-only', 'many']);
    });

    it('leaves out a product that matches none of the answers beyond its category', () => {
      const lineup = [
        item('strong-black', { caffeine: 'high', tags: ['black', 'malty'], variants: sold('k-cup') }),
        item('floral', { tags: ['floral'] }),
      ];
      expect(slugs(recommend(answers, lineup))).toEqual(['floral']);
      expect(recommend(answers, [lineup[0]])).toEqual([]);
    });

    it('matches tags without regard to case or spacing', () => {
      const lineup = [item('shouty', { tags: ['  FLORAL '] })];
      expect(slugs(recommend(answers, lineup))).toEqual(['shouty']);
    });

    it('copes with a product that has no tags, no caffeine level or odd tags', () => {
      const lineup = [
        { slug: 'bare', category: 'tea', variants: sold('loose-leaf') },
        item('odd-tags', { tags: [null, 42, '', '   ', 'floral'] }),
        item('not-a-list', { tags: 'floral' }),
      ];
      expect(slugs(recommend(answers, lineup))).toEqual(['odd-tags', 'bare']);
    });
  });

  describe('the answers', () => {
    it('knows every tag its flavor families list', () => {
      for (const option of question('flavor').answers) {
        for (const tag of option.tags) {
          const only = item(`only-${tag}`, { caffeine: 'high', tags: [tag] });
          const picks = recommend({ drink: 'tea', flavor: option.id }, [only]);
          expect(slugs(picks), `${option.id} should find a product tagged ${tag}`).toEqual([only.slug]);
        }
      }
    });

    it('knows every aroma its aroma families list', () => {
      for (const option of question('aroma').answers) {
        for (const aroma of option.aromas ?? []) {
          const only = item(`only-${aroma}`, { caffeine: 'high', aromas: [aroma] });
          const picks = recommend({ drink: 'tea', aroma: option.id }, [only]);
          expect(slugs(picks), `${option.id} should find a product with ${aroma}`).toEqual([only.slug]);
        }
      }
    });

    it('does not let one aroma family find the aromas of another', () => {
      const jasmine = item('jasmine-tea', { aromas: ['jasmine'] });
      for (const other of ['toasty', 'citrus', 'sweet', 'fresh']) {
        expect(recommend({ drink: 'tea', aroma: other }, [jasmine]), other).toEqual([]);
      }
    });

    it('does not let one flavor family find the tags of another', () => {
      const floral = item('floral-tea', { tags: ['floral'] });
      expect(recommend({ drink: 'tea', flavor: 'fruity' }, [floral])).toEqual([]);
      expect(recommend({ drink: 'tea', flavor: 'earthy' }, [floral])).toEqual([]);
      expect(recommend({ drink: 'tea', flavor: 'sweet-spiced' }, [floral])).toEqual([]);
    });

    it('finds sweet/spiced by either word', () => {
      const lineup = [item('sweet', { tags: ['sweet'] }), item('spiced', { tags: ['spiced'] })];
      expect(slugs(recommend({ drink: 'tea', flavor: 'sweet-spiced' }, lineup))).toEqual([
        'sweet',
        'spiced',
      ]);
    });

    it('knows every format its style answers list', () => {
      for (const option of question('style').answers) {
        for (const format of option.formats ?? []) {
          const category = ['whole-bean', 'ground'].includes(format) ? 'coffee' : 'tea';
          const only = item(`only-${format}`, { category, caffeine: 'high', variants: sold(format) });
          const picks = recommend({ drink: 'either', style: option.id }, [only]);
          expect(slugs(picks), `${option.id} should find ${format}`).toEqual([only.slug]);
        }
      }
    });

    it('gives "either" for style no points: it prefers no format', () => {
      const lineup = [item('loose', { variants: sold('loose-leaf') })];
      expect(recommend({ drink: 'tea', style: 'either' }, lineup)).toEqual([]);
    });

    it('needs an answer beyond the category to match on', () => {
      const lineup = [item('a-tea', { caffeine: 'none', tags: ['floral'] })];
      expect(recommend({ drink: 'tea' }, lineup)).toEqual([]);
      expect(recommend({ drink: 'either' }, lineup)).toEqual([]);
    });

    it('ignores answers it does not know, and treats a missing answer as no preference', () => {
      const lineup = [item('none', { caffeine: 'none' })];
      expect(slugs(recommend({ drink: 'tea', caffeine: 'none', flavor: 'minty', style: '' }, lineup))).toEqual([
        'none',
      ]);
      expect(slugs(recommend({ drink: 'soda', caffeine: 'none', nonsense: 'yes' }, lineup))).toEqual([
        'none',
      ]);
    });

    it('returns nothing when there are no answers at all', () => {
      const lineup = [item('a-tea', { caffeine: 'none', tags: ['floral'] })];
      expect(recommend({}, lineup)).toEqual([]);
      expect(recommend(undefined, lineup)).toEqual([]);
      expect(recommend(null, lineup)).toEqual([]);
    });

    it('does not mistake an object property name for an answer', () => {
      const lineup = [item('a-tea', { caffeine: 'none', tags: ['floral'] })];
      expect(recommend({ drink: 'constructor', caffeine: 'toString', flavor: '__proto__' }, lineup)).toEqual([]);
    });
  });

  describe('the list it returns', () => {
    it('is at most three long', () => {
      expect(MAX_RECOMMENDATIONS).toBe(3);
      const lineup = ['a', 'b', 'c', 'd', 'e'].map((slug) => item(slug, { caffeine: 'none' }));
      expect(slugs(recommend(TEA_NONE_FLORAL_RITUAL, lineup))).toEqual(['a', 'b', 'c']);
    });

    it('keeps the best three, not the first three', () => {
      const lineup = [
        item('weak-1', { caffeine: 'none' }), // 8
        item('weak-2', { caffeine: 'none' }), // 8
        item('strong-1', { caffeine: 'none', tags: ['floral'] }), // 8 + 4
        item('strong-2', { caffeine: 'none', variants: sold('loose-leaf') }), // 8 + 1
        item('strong-3', { caffeine: 'none', tags: ['floral'], variants: sold('loose-leaf') }), // 8 + 4 + 1
      ];
      expect(slugs(recommend(TEA_NONE_FLORAL_RITUAL, lineup))).toEqual([
        'strong-3',
        'strong-1',
        'strong-2',
      ]);
    });

    it('is the products themselves, not copies', () => {
      const first = item('first', { caffeine: 'none' });
      const picks = recommend(TEA_NONE_FLORAL_RITUAL, [first]);
      expect(picks[0]).toBe(first);
    });

    it('is a new array each time', () => {
      const lineup = [item('first', { caffeine: 'none' })];
      expect(recommend(TEA_NONE_FLORAL_RITUAL, lineup)).not.toBe(recommend(TEA_NONE_FLORAL_RITUAL, lineup));
    });

    it('does not change the lists it is given', () => {
      const lineup = [
        item('b', { tags: ['floral'] }),
        item('a', { caffeine: 'none', tags: ['floral'], variants: sold('loose-leaf') }),
      ];
      const answers = { ...TEA_NONE_FLORAL_RITUAL };
      const before = JSON.stringify([lineup, answers]);
      recommend(answers, lineup);
      expect(JSON.stringify([lineup, answers])).toBe(before);
    });
  });
});

describe('interestFor', () => {
  it('is the category the shopper chose', () => {
    expect(interestFor({ drink: 'tea' })).toBe('tea');
    expect(interestFor({ drink: 'coffee' })).toBe('coffee');
  });

  it('is "both" for either', () => {
    expect(interestFor({ drink: 'either' })).toBe('both');
  });

  it('is "both" when the drink is missing or unknown', () => {
    expect(interestFor({})).toBe('both');
    expect(interestFor(undefined)).toBe('both');
    expect(interestFor({ drink: 'soda' })).toBe('both');
  });
});

describe('cleanAnswers', () => {
  it("keeps every answer that is one of its question's ids", () => {
    const answers = {
      drink: 'either',
      caffeine: 'high',
      flavor: 'sweet-spiced',
      aroma: 'toasty',
      style: 'quick',
    };
    expect(cleanAnswers(answers)).toEqual(answers);
  });

  it('drops an aroma id that is not an aroma answer', () => {
    expect(cleanAnswers({ aroma: 'earthy', flavor: 'fruity' })).toEqual({ flavor: 'fruity' });
    expect(cleanAnswers({ aroma: 'smoky' })).toEqual({});
  });

  it('accepts every answer id of every question', () => {
    for (const question of QUIZ_QUESTIONS) {
      for (const answer of question.answers) {
        expect(cleanAnswers({ [question.id]: answer.id })).toEqual({ [question.id]: answer.id });
      }
    }
  });

  it('drops ids that belong to no answer, or to another question', () => {
    expect(
      cleanAnswers({ drink: 'soda', caffeine: 'floral', flavor: 'Floral', style: 'ritual' }),
    ).toEqual({ style: 'ritual' });
  });

  it('drops keys that are not questions, and values that are not text', () => {
    expect(
      cleanAnswers({ drink: ['tea'], caffeine: 4, flavor: null, style: { id: 'quick' }, email: 'a@b.c' }),
    ).toEqual({});
  });

  it('does not find an answer through an object property name', () => {
    expect(cleanAnswers({ drink: 'constructor', style: 'toString' })).toEqual({});
  });

  it.each([undefined, null, 'tea', 7, ['tea']])('gives {} for %j', (value) => {
    expect(cleanAnswers(value)).toEqual({});
  });

  it('returns a new object', () => {
    const answers = { drink: 'tea' };
    expect(cleanAnswers(answers)).not.toBe(answers);
  });
});
