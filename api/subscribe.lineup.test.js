import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getProducts } from '../lib/catalog.js';
import { recommend } from '../lib/quiz.js';
import handler from './subscribe.js';

// The quiz-to-contact path against a test lineup: the picks recommend() makes from the
// answers are what the quiz shows and sends, and they must come out as quiz_top_match
// and quiz_matches on the Resend contact. The real lineup.json is empty in this repo,
// so this file swaps in a fixture. Resend is a fake, as in subscribe.test.js.
const resend = vi.hoisted(() => {
  const createContact = vi.fn();
  const updateContact = vi.fn();
  const addToSegment = vi.fn();
  const removeFromSegment = vi.fn();
  const Resend = vi.fn(function () {
    this.contacts = {
      create: createContact,
      update: updateContact,
      segments: { add: addToSegment, remove: removeFromSegment },
    };
  });
  return { Resend, createContact, updateContact, addToSegment, removeFromSegment };
});
vi.mock('resend', () => ({ Resend: resend.Resend }));

vi.mock('../src/data/lineup.json', () => {
  const sold = (format) => [
    { id: `${format}-1`, format, size_label: '1', price_cents: 1000, stripe_price_id: `price_${format}` },
  ];
  const tea = (slug, fields) => ({
    slug,
    name: slug,
    category: 'tea',
    short_description: slug,
    flavor_notes: [],
    featured: false,
    images: [],
    variants: sold('tea-bags'),
    ...fields,
  });
  return {
    default: {
      products: [
        tea('smoky-oolong', { caffeine: 'medium', tags: ['earthy'], aromas: ['smoky', 'roasted'] }),
        tea('earl-grey', { caffeine: 'high', tags: ['floral', 'fruity'], aromas: ['bergamot'] }),
        tea('lemon-sencha', {
          caffeine: 'medium',
          tags: ['fruity'],
          aromas: ['lemon', 'grassy'],
          variants: sold('loose-leaf'),
        }),
        tea('berry-medley', { caffeine: 'medium', tags: ['fruity'], aromas: ['vanilla'] }),
        tea('jasmine-pearls', { caffeine: 'low', tags: ['floral'], aromas: ['jasmine'] }),
      ],
    },
  };
});

async function post(body) {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  await handler({ method: 'POST', headers: {}, body }, res);
  return res;
}

const success = (data) => ({ data, error: null, headers: null });

beforeEach(() => {
  vi.stubEnv('RESEND_API_KEY', 're_fake');
  vi.stubEnv('RESEND_AUDIENCE_ID', 'aud_test');
  for (const spy of Object.values(resend)) spy.mockReset();
  resend.createContact.mockResolvedValue(success({ id: 'contact_1' }));
  resend.addToSegment.mockResolvedValue(success({ id: 'contact_1' }));
  resend.removeFromSegment.mockResolvedValue(success({ id: 'contact_1' }));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const ANSWERS = { drink: 'tea', caffeine: 'medium', flavor: 'fruity', aroma: 'citrus', style: 'ritual' };

describe('a quiz signup with a test lineup', () => {
  it('ranks first the product whose tags and aromas best fit the answers', () => {
    // lemon-sencha: medium, fruity, lemon, loose leaf (8 + 4 + 2 + 1). berry-medley:
    // medium and fruity (8 + 4). smoky-oolong: medium only (8).
    const picks = recommend(ANSWERS, getProducts()).map((product) => product.slug);
    expect(picks).toEqual(['lemon-sencha', 'berry-medley', 'smoky-oolong']);
  });

  it('saves the on-screen picks as quiz_matches, with the first as quiz_top_match', async () => {
    const picks = recommend(ANSWERS, getProducts()).map((product) => product.slug);

    const res = await post({
      email: 'jane@example.com',
      answers: ANSWERS,
      topMatch: picks[0],
      matches: picks,
      source: 'quiz',
    });

    expect(res.body).toEqual({ ok: true });
    expect(resend.createContact.mock.calls[0][0].properties).toEqual({
      interest: 'tea',
      signup_source: 'quiz',
      quiz_caffeine: 'medium',
      quiz_flavor: 'fruity',
      quiz_aroma: 'citrus',
      quiz_style: 'ritual',
      quiz_top_match: 'lemon-sencha',
      quiz_matches: 'lemon-sencha,berry-medley,smoky-oolong',
    });
  });

  it('drops a slug that is not in the lineup from quiz_matches', async () => {
    await post({
      email: 'jane@example.com',
      answers: ANSWERS,
      matches: ['lemon-sencha', 'made-up-tea', 'earl-grey'],
      source: 'quiz',
    });

    expect(resend.createContact.mock.calls[0][0].properties).toMatchObject({
      quiz_top_match: 'lemon-sencha',
      quiz_matches: 'lemon-sencha,earl-grey',
    });
  });
});
