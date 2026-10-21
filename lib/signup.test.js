import { describe, it, expect } from 'vitest';
import { contactProperties, readSignup, segmentsFor } from './signup.js';

// A small lineup, so a top match has real slugs to be checked against.
const LINEUP = {
  products: [
    { slug: 'chamomile-meadow', category: 'tea' },
    { slug: 'dawn-roast', category: 'coffee' },
    { slug: 'rose-garden', category: 'tea' },
    { slug: 'lemon-sencha', category: 'tea' },
  ],
};

const ANSWERS = { drink: 'tea', caffeine: 'none', flavor: 'floral', aroma: 'fresh', style: 'ritual' };
const MATCHES = ['chamomile-meadow', 'rose-garden', 'lemon-sencha'];

describe('readSignup', () => {
  it('reads a full quiz signup', () => {
    expect(
      readSignup(
        { answers: ANSWERS, topMatch: 'chamomile-meadow', matches: MATCHES, source: 'quiz' },
        LINEUP,
      ),
    ).toEqual({
      interest: 'tea',
      source: 'quiz',
      answers: ANSWERS,
      topMatch: 'chamomile-meadow',
      matches: MATCHES,
    });
  });

  it('keeps the aroma answer beside the flavor answer', () => {
    const { answers } = readSignup({ answers: { flavor: 'fruity', aroma: 'citrus' } }, LINEUP);
    expect(answers).toEqual({ flavor: 'fruity', aroma: 'citrus' });
  });

  it('drops an aroma that is not an aroma answer', () => {
    const { answers } = readSignup({ answers: { flavor: 'fruity', aroma: 'lemon' } }, LINEUP);
    expect(answers).toEqual({ flavor: 'fruity' });
  });

  describe('matches', () => {
    it('keeps only slugs in the lineup, in the order sent', () => {
      const matches = ['lemon-sencha', 'no-such-tea', 'dawn-roast', 7, null, 'Rose-Garden'];
      expect(readSignup({ matches }, LINEUP).matches).toEqual(['lemon-sencha', 'dawn-roast']);
    });

    it('keeps each slug once', () => {
      const matches = ['dawn-roast', 'dawn-roast', 'rose-garden'];
      expect(readSignup({ matches }, LINEUP).matches).toEqual(['dawn-roast', 'rose-garden']);
    });

    it('keeps at most three', () => {
      const matches = ['dawn-roast', 'rose-garden', 'lemon-sencha', 'chamomile-meadow'];
      expect(readSignup({ matches }, LINEUP).matches).toEqual([
        'dawn-roast',
        'rose-garden',
        'lemon-sencha',
      ]);
    });

    it.each([[undefined], [null], ['dawn-roast'], [{ 0: 'dawn-roast' }], [3]])(
      'is [] for matches of %j',
      (matches) => {
        expect(readSignup({ matches }, LINEUP).matches).toEqual([]);
      },
    );

    it('sets the top match to the first match, so the two always agree', () => {
      expect(readSignup({ matches: ['rose-garden', 'dawn-roast'] }, LINEUP).topMatch).toBe(
        'rose-garden',
      );
      expect(
        readSignup({ topMatch: 'dawn-roast', matches: ['bogus', 'rose-garden'] }, LINEUP).topMatch,
      ).toBe('rose-garden');
    });

    it('still takes a top match on its own when there are no valid matches', () => {
      expect(readSignup({ topMatch: 'dawn-roast', matches: ['bogus'] }, LINEUP)).toMatchObject({
        topMatch: 'dawn-roast',
        matches: [],
      });
    });
  });

  it.each([
    ['tea', 'tea'],
    ['coffee', 'coffee'],
    ['either', 'both'],
  ])('maps the drink answer %s to interest %s', (drink, interest) => {
    expect(readSignup({ answers: { drink } }, LINEUP).interest).toBe(interest);
  });

  it('takes the drink answer over an interest sent beside it', () => {
    expect(readSignup({ interest: 'tea', answers: { drink: 'coffee' } }, LINEUP).interest).toBe(
      'coffee',
    );
  });

  it('falls back to the interest field when the drink answer is missing or bad', () => {
    expect(readSignup({ interest: 'coffee' }, LINEUP).interest).toBe('coffee');
    expect(readSignup({ interest: 'coffee', answers: { drink: 'soda' } }, LINEUP).interest).toBe(
      'coffee',
    );
  });

  it.each([['wine'], [''], [7], [null], [['tea']], [{ tea: true }]])(
    'has no interest for an interest of %j',
    (interest) => {
      expect(readSignup({ interest }, LINEUP).interest).toBeNull();
    },
  );

  it.each([
    ['quiz', 'quiz'],
    ['site', 'site'],
    ['missing', undefined],
    ['unknown', 'admin'],
    ['not text', 1],
  ])('reads a source that is %s as the right one', (_case, source) => {
    const expected = source === 'quiz' ? 'quiz' : 'site';
    expect(readSignup({ source }, LINEUP).source).toBe(expected);
  });

  it('keeps a top match only when it is a slug in the lineup', () => {
    expect(readSignup({ topMatch: 'dawn-roast' }, LINEUP).topMatch).toBe('dawn-roast');
    expect(readSignup({ topMatch: 'no-such-tea' }, LINEUP).topMatch).toBeNull();
    expect(readSignup({ topMatch: 'Dawn-Roast' }, LINEUP).topMatch).toBeNull();
    expect(readSignup({ topMatch: ['dawn-roast'] }, LINEUP).topMatch).toBeNull();
    expect(readSignup({ topMatch: 3 }, LINEUP).topMatch).toBeNull();
  });

  it('drops garbage answers and keeps the good ones', () => {
    expect(
      readSignup({ answers: { drink: 'tea', caffeine: 'lots', flavor: 1, style: 'quick' } }, LINEUP)
        .answers,
    ).toEqual({ drink: 'tea', style: 'quick' });
  });

  it.each([undefined, null, 'email=x', []])('reads a body of %j as an empty site signup', (body) => {
    expect(readSignup(body, LINEUP)).toEqual({
      interest: null,
      source: 'site',
      answers: {},
      topMatch: null,
      matches: [],
    });
  });
});

describe('contactProperties: a new contact', () => {
  it('saves interest "both" and source "site" for a bare signup', () => {
    expect(contactProperties(readSignup({}, LINEUP))).toEqual({
      interest: 'both',
      signup_source: 'site',
    });
  });

  it('saves a page interest with source "site"', () => {
    expect(contactProperties(readSignup({ interest: 'tea', source: 'site' }, LINEUP))).toEqual({
      interest: 'tea',
      signup_source: 'site',
    });
  });

  it('saves every quiz property for a full quiz signup', () => {
    const signup = readSignup(
      { answers: ANSWERS, topMatch: 'chamomile-meadow', matches: MATCHES, source: 'quiz' },
      LINEUP,
    );
    expect(contactProperties(signup)).toEqual({
      interest: 'tea',
      signup_source: 'quiz',
      quiz_caffeine: 'none',
      quiz_flavor: 'floral',
      quiz_aroma: 'fresh',
      quiz_style: 'ritual',
      quiz_top_match: 'chamomile-meadow',
      quiz_matches: 'chamomile-meadow,rose-garden,lemon-sencha',
    });
  });

  it('writes quiz_matches as the valid picks joined by commas, top match first', () => {
    const signup = readSignup(
      { answers: ANSWERS, matches: ['rose-garden', 'nope', 'dawn-roast'], source: 'quiz' },
      LINEUP,
    );
    const properties = contactProperties(signup);
    expect(properties.quiz_matches).toBe('rose-garden,dawn-roast');
    expect(properties.quiz_top_match).toBe('rose-garden');
  });

  it('saves a single pick as a one-slug quiz_matches', () => {
    const signup = readSignup({ answers: ANSWERS, matches: ['dawn-roast'], source: 'quiz' }, LINEUP);
    expect(contactProperties(signup)).toMatchObject({
      quiz_top_match: 'dawn-roast',
      quiz_matches: 'dawn-roast',
    });
  });

  it('leaves out a quiz property it has no value for, instead of sending null', () => {
    const signup = readSignup({ answers: { drink: 'either', style: 'quick' }, source: 'quiz' }, LINEUP);
    expect(contactProperties(signup)).toEqual({
      interest: 'both',
      signup_source: 'quiz',
      quiz_style: 'quick',
    });
  });

  it('only ever writes string values', () => {
    const signup = readSignup({ answers: ANSWERS, matches: MATCHES, source: 'quiz' }, LINEUP);
    for (const value of Object.values(contactProperties(signup))) {
      expect(typeof value).toBe('string');
    }
  });
});

describe('contactProperties: a contact that is already on the list', () => {
  const existing = { existing: true };

  it('writes only the source when the signup says nothing else, keeping the old interest', () => {
    expect(contactProperties(readSignup({}, LINEUP), existing)).toEqual({ signup_source: 'site' });
  });

  it('writes a new interest', () => {
    expect(contactProperties(readSignup({ interest: 'coffee' }, LINEUP), existing)).toEqual({
      interest: 'coffee',
      signup_source: 'site',
    });
  });

  it('overwrites every quiz property on a retake, clearing the ones with no value', () => {
    const signup = readSignup(
      { answers: { drink: 'coffee', caffeine: 'high', style: 'quick' }, source: 'quiz' },
      LINEUP,
    );
    expect(contactProperties(signup, existing)).toEqual({
      interest: 'coffee',
      signup_source: 'quiz',
      quiz_caffeine: 'high',
      quiz_flavor: null,
      quiz_aroma: null,
      quiz_style: 'quick',
      quiz_top_match: null,
      quiz_matches: null,
    });
  });

  it('replaces the old matches with the new picks on a retake', () => {
    const signup = readSignup(
      { answers: ANSWERS, matches: ['lemon-sencha', 'rose-garden'], source: 'quiz' },
      LINEUP,
    );
    expect(contactProperties(signup, existing)).toMatchObject({
      quiz_aroma: 'fresh',
      quiz_top_match: 'lemon-sencha',
      quiz_matches: 'lemon-sencha,rose-garden',
    });
  });
});

describe('segmentsFor', () => {
  it.each([
    ['tea', { join: ['tea'], leave: ['coffee'] }],
    ['coffee', { join: ['coffee'], leave: ['tea'] }],
    ['both', { join: ['tea', 'coffee'], leave: [] }],
    [null, { join: [], leave: [] }],
    ['wine', { join: [], leave: [] }],
  ])('for %j joins and leaves %j', (interest, expected) => {
    expect(segmentsFor(interest)).toEqual(expected);
  });
});
