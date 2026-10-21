import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from './subscribe.js';

// No test here can reach Resend. The resend module is replaced by a fake whose
// methods are spies, so the tests can see what the handler asked for. Signing up
// must only ever add or update a contact, so the ways to send mail are spies too, and
// the tests check that nothing used them.
const resend = vi.hoisted(() => {
  const createContact = vi.fn();
  const updateContact = vi.fn();
  const addToSegment = vi.fn();
  const removeFromSegment = vi.fn();
  const sendEmail = vi.fn();
  const sendBatch = vi.fn();
  // A plain function, not an arrow function, because the handler calls it with `new`.
  const Resend = vi.fn(function () {
    this.contacts = {
      create: createContact,
      update: updateContact,
      segments: { add: addToSegment, remove: removeFromSegment },
    };
    this.emails = { send: sendEmail };
    this.batch = { send: sendBatch };
  });
  return { Resend, createContact, updateContact, addToSegment, removeFromSegment, sendEmail, sendBatch };
});
vi.mock('resend', () => ({ Resend: resend.Resend }));

const API_KEY = 're_fake';
const AUDIENCE_ID = 'aud_test_123';
const TEA_SEGMENT = 'seg_tea_123';
const COFFEE_SEGMENT = 'seg_coffee_123';

// What a signup with nothing but an email is saved with.
const SITE_DEFAULTS = { interest: 'both', signup_source: 'site' };

// The three bodies the visitor can be answered with.
const SAVED = { ok: true };
const INVALID = { error: 'Please enter a valid email.' };
const FAILED = { error: 'Something went wrong. Please try again.' };

// What resend v6 hands back for a failed call: it returns { error } and does not throw.
const failure = (error) => ({ data: null, error, headers: null });

// An address that is exactly `length` characters long. The name part is far longer
// than a real one may be, but the handler only checks the whole length.
const ADDRESS_END = '@example.com';
const addressOfLength = (length) => 'a'.repeat(length - ADDRESS_END.length) + ADDRESS_END;

// Run the handler once and hand back what it answered.
async function post(body, { method = 'POST' } = {}) {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  await handler({ method, headers: {}, body }, res);
  return res;
}

// The one contact the handler asked Resend to create.
const createdContact = () => resend.createContact.mock.calls[0][0];

// Keeps an expected server-side log line out of the test output.
const silenceErrorLog = () => vi.spyOn(console, 'error').mockImplementation(() => {});

// What resend v6 hands back for a call that worked.
const success = (data) => ({ data, error: null, headers: null });

beforeEach(() => {
  vi.stubEnv('RESEND_API_KEY', API_KEY);
  vi.stubEnv('RESEND_AUDIENCE_ID', AUDIENCE_ID);
  vi.stubEnv('RESEND_SEGMENT_TEA', TEA_SEGMENT);
  vi.stubEnv('RESEND_SEGMENT_COFFEE', COFFEE_SEGMENT);
  for (const spy of Object.values(resend)) spy.mockReset();
  resend.createContact.mockResolvedValue(success({ object: 'contact', id: 'contact_1' }));
  resend.updateContact.mockResolvedValue(success({ object: 'contact', id: 'contact_1' }));
  resend.addToSegment.mockResolvedValue(success({ id: 'contact_1' }));
  resend.removeFromSegment.mockResolvedValue(success({ id: 'contact_1', deleted: true }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('saving a signup', () => {
  it('adds a valid email to the audience with one contacts.create call', async () => {
    const res = await post({ email: 'jane@example.com' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(SAVED);
    expect(resend.Resend).toHaveBeenCalledWith(API_KEY);
    expect(resend.createContact).toHaveBeenCalledTimes(1);
    expect(resend.createContact).toHaveBeenCalledWith({
      email: 'jane@example.com',
      audienceId: AUDIENCE_ID,
      unsubscribed: false,
      properties: SITE_DEFAULTS,
    });
  });

  it('sends no email, whether the address is new or already on the list', async () => {
    await post({ email: 'new@example.com' });
    resend.createContact.mockResolvedValue(
      failure({ name: 'validation_error', statusCode: 409, message: 'Contact already exists.' }),
    );
    await post({ email: 'old@example.com' });

    expect(resend.createContact).toHaveBeenCalledTimes(2);
    expect(resend.sendEmail).not.toHaveBeenCalled();
    expect(resend.sendBatch).not.toHaveBeenCalled();
  });

  it.each([
    ['open', 'true'],
    ['closed', 'false'],
    ['not set', undefined],
  ])('saves the signup when the store is %s', async (_state, flag) => {
    vi.stubEnv('STORE_OPEN', flag);
    vi.stubEnv('VITE_STORE_OPEN', flag);

    const res = await post({ email: 'jane@example.com' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(SAVED);
    expect(resend.createContact).toHaveBeenCalledTimes(1);
  });
});

describe('the email address', () => {
  it('trims and lowercases the address before saving it', async () => {
    const res = await post({ email: '  Jane.Doe@Example.COM \n' });

    expect(res.statusCode).toBe(200);
    expect(createdContact().email).toBe('jane.doe@example.com');
  });

  it.each([
    ['not-an-email', 'not-an-email'],
    ['an empty string', ''],
    ['only spaces', '   '],
    // Well formed, so only the 254-character cap turns it away.
    ['a 300-character address', addressOfLength(300)],
    ['a name with no domain', 'jane@'],
    ['a domain with no name', '@example.com'],
    ['a domain with no dot', 'jane@example'],
    ['nothing after the last dot', 'jane@example.'],
    ['two @ signs', 'jane@@example.com'],
    ['a space inside', 'jane doe@example.com'],
  ])('answers 400 to %s', async (_case, email) => {
    const res = await post({ email });

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual(INVALID);
    expect(resend.createContact).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['a number', 12345],
    ['a boolean', true],
    ['an array', ['jane@example.com']],
    ['an object', { address: 'jane@example.com' }],
  ])('answers 400 when the email is %s', async (_case, email) => {
    const res = await post({ email });

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual(INVALID);
    expect(resend.createContact).not.toHaveBeenCalled();
  });

  it.each([
    ['no body', undefined],
    ['a null body', null],
    ['an empty body', {}],
    ['a body that was not parsed as JSON', 'email=jane@example.com'],
  ])('answers 400 to %s', async (_case, body) => {
    const res = await post(body);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual(INVALID);
    expect(resend.createContact).not.toHaveBeenCalled();
  });

  it('accepts an address of exactly 254 characters', async () => {
    const email = addressOfLength(254);
    expect(email).toHaveLength(254);

    const res = await post({ email });

    expect(res.statusCode).toBe(200);
    expect(createdContact().email).toBe(email);
  });

  it('rejects an address of 255 characters', async () => {
    const email = addressOfLength(255);
    expect(email).toHaveLength(255);

    const res = await post({ email });

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual(INVALID);
    expect(resend.createContact).not.toHaveBeenCalled();
  });

  it('measures the length after trimming, so padding does not push a 254-character address over', async () => {
    const email = addressOfLength(254);

    const res = await post({ email: `  ${email}  ` });

    expect(res.statusCode).toBe(200);
    expect(createdContact().email).toBe(email);
  });
});

// The form may send `interest`. It is saved as the contact's `interest` property.
describe('interest', () => {
  it.each(['tea', 'coffee', 'both'])('saves "%s" as the interest property', async (interest) => {
    const res = await post({ email: 'jane@example.com', interest });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(SAVED);
    expect(resend.createContact).toHaveBeenCalledWith({
      email: 'jane@example.com',
      audienceId: AUDIENCE_ID,
      unsubscribed: false,
      properties: { interest, signup_source: 'site' },
    });
  });

  it.each([
    ['a word that is not an option', 'wine'],
    ['an empty string', ''],
    ['a number', 7],
    ['null', null],
    ['an array', ['tea']],
    ['an object', { tea: true }],
  ])('drops an interest that is %s and saves "both" instead of refusing the signup', async (_case, interest) => {
    const res = await post({ email: 'jane@example.com', interest });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(SAVED);
    expect(resend.createContact).toHaveBeenCalledTimes(1);
    expect(createdContact().properties).toEqual(SITE_DEFAULTS);
  });
});

// The quiz sends its answers, its first pick and source 'quiz'. Every value is checked
// against the quiz's own answer ids (lib/quiz.js) and the lineup's slugs.
describe('quiz answers', () => {
  const ANSWERS = {
    drink: 'tea',
    mood: 'calm',
    caffeine: 'none',
    flavor: 'floral',
    aroma: 'fresh',
    style: 'ritual',
  };

  it('saves the answers, the top match and the source as contact properties', async () => {
    const res = await post({
      email: 'jane@example.com',
      answers: ANSWERS,
      topMatch: 'chamomile-meadow',
      matches: ['chamomile-meadow', 'rose-garden'],
      source: 'quiz',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(SAVED);
    // The lineup is empty in this repo, so no slug can be a real match here; the slug
    // check is tested in lib/signup.test.js, and against a lineup fixture in
    // api/subscribe.lineup.test.js.
    expect(createdContact().properties).toEqual({
      interest: 'tea',
      signup_source: 'quiz',
      quiz_mood: 'calm',
      quiz_caffeine: 'none',
      quiz_flavor: 'floral',
      quiz_aroma: 'fresh',
      quiz_style: 'ritual',
    });
  });

  it('saves the mood answer as quiz_mood', async () => {
    const res = await post({
      email: 'jane@example.com',
      answers: { drink: 'tea', mood: 'refreshed' },
      source: 'quiz',
    });

    expect(res.statusCode).toBe(200);
    expect(createdContact().properties).toEqual({
      interest: 'tea',
      signup_source: 'quiz',
      quiz_mood: 'refreshed',
    });
  });

  it.each(['calm', 'focused', 'energized', 'cozy', 'refreshed'])('saves the mood %s', async (mood) => {
    await post({ email: 'jane@example.com', answers: { ...ANSWERS, mood }, source: 'quiz' });

    expect(createdContact().properties.quiz_mood).toBe(mood);
  });

  it('saves both the flavor and the aroma answer', async () => {
    await post({
      email: 'jane@example.com',
      answers: { drink: 'coffee', flavor: 'earthy', aroma: 'toasty' },
      source: 'quiz',
    });

    expect(createdContact().properties).toMatchObject({ quiz_flavor: 'earthy', quiz_aroma: 'toasty' });
  });

  it.each([
    ['tea', 'tea'],
    ['coffee', 'coffee'],
    ['either', 'both'],
  ])('maps the drink answer %s to interest %s', async (drink, interest) => {
    await post({ email: 'jane@example.com', answers: { ...ANSWERS, drink }, source: 'quiz' });

    expect(createdContact().properties.interest).toBe(interest);
  });

  it('prefers the drink answer to an interest sent beside it', async () => {
    await post({ email: 'jane@example.com', interest: 'tea', answers: { ...ANSWERS, drink: 'coffee' } });

    expect(createdContact().properties.interest).toBe('coffee');
  });

  it('drops garbage answers and keeps the good ones, and the signup still succeeds', async () => {
    const res = await post({
      email: 'jane@example.com',
      answers: {
        drink: 'wine',
        caffeine: 'extreme',
        flavor: ['floral'],
        aroma: 'garlic',
        mood: 'sleepy',
        style: 'quick',
        extra: 'x',
      },
      topMatch: '../../etc/passwd',
      matches: ['../../etc/passwd', 42, { slug: 'x' }],
      source: 'admin',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(SAVED);
    expect(createdContact().properties).toEqual({
      interest: 'both',
      signup_source: 'site',
      quiz_style: 'quick',
    });
  });

  it.each([
    ['a string', 'tea'],
    ['an array', ['tea']],
    ['null', null],
    ['a number', 4],
  ])('ignores answers that are %s', async (_case, answers) => {
    const res = await post({ email: 'jane@example.com', answers, topMatch: 42, matches: 'all' });

    expect(res.statusCode).toBe(200);
    expect(createdContact().properties).toEqual(SITE_DEFAULTS);
  });
});

// Signing up again with the same address (re-taking the quiz, say) updates the contact.
describe('an address that is already on the list: properties', () => {
  const duplicate = () =>
    resend.createContact.mockResolvedValue(
      failure({ name: 'validation_error', statusCode: 409, message: 'Contact already exists.' }),
    );
  const updatedContact = () => resend.updateContact.mock.calls[0][0];

  it('updates the properties instead of failing, and answers ok', async () => {
    duplicate();

    const res = await post({
      email: 'jane@example.com',
      answers: {
        drink: 'coffee',
        mood: 'focused',
        caffeine: 'high',
        flavor: 'earthy',
        aroma: 'toasty',
        style: 'quick',
      },
      source: 'quiz',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(SAVED);
    expect(resend.updateContact).toHaveBeenCalledTimes(1);
    expect(updatedContact()).toEqual({
      email: 'jane@example.com',
      properties: {
        interest: 'coffee',
        signup_source: 'quiz',
        quiz_mood: 'focused',
        quiz_caffeine: 'high',
        quiz_flavor: 'earthy',
        quiz_aroma: 'toasty',
        quiz_style: 'quick',
        // Cleared, so no stale picks from an earlier quiz are left behind.
        quiz_top_match: null,
        quiz_matches: null,
      },
    });
  });

  it('answers ok to the same address twice, creating it once and updating it once', async () => {
    const first = await post({ email: 'jane@example.com', interest: 'tea' });
    duplicate();
    const second = await post({ email: 'jane@example.com', interest: 'coffee' });

    expect(first.body).toEqual(SAVED);
    expect(second.body).toEqual(SAVED);
    expect(resend.createContact).toHaveBeenCalledTimes(2);
    expect(resend.updateContact).toHaveBeenCalledTimes(1);
    expect(updatedContact().properties).toEqual({ interest: 'coffee', signup_source: 'site' });
  });

  it('does not overwrite a known interest with the fallback when this signup says none', async () => {
    duplicate();

    await post({ email: 'jane@example.com' });

    expect(updatedContact().properties).toEqual({ signup_source: 'site' });
  });

  it('leaves the subscribed setting alone on an update', async () => {
    duplicate();

    await post({ email: 'jane@example.com', interest: 'tea' });

    expect(updatedContact()).not.toHaveProperty('unsubscribed');
  });

  it('does not update a contact that was just created', async () => {
    await post({ email: 'jane@example.com', interest: 'tea' });

    expect(resend.updateContact).not.toHaveBeenCalled();
  });

  it('answers 500 and logs it when the update fails', async () => {
    const log = silenceErrorLog();
    duplicate();
    const error = { name: 'application_error', statusCode: 500, message: 'Internal error' };
    resend.updateContact.mockResolvedValue(failure(error));

    const res = await post({ email: 'jane@example.com', interest: 'tea' });

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual(FAILED);
    expect(log.mock.calls[0]).toContain(error);
    expect(resend.addToSegment).not.toHaveBeenCalled();
  });

  it('waits and tries the update once more when Resend says to slow down', async () => {
    vi.useFakeTimers();
    try {
      duplicate();
      resend.updateContact.mockResolvedValueOnce(
        failure({ name: 'rate_limit_exceeded', statusCode: 429, message: 'Too many requests' }),
      );

      const pending = post({ email: 'jane@example.com', interest: 'tea' });
      await vi.advanceTimersByTimeAsync(1000);
      const res = await pending;

      expect(res.body).toEqual(SAVED);
      expect(resend.updateContact).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

// Tea lovers go in RESEND_SEGMENT_TEA, coffee lovers in RESEND_SEGMENT_COFFEE, and
// 'both' in the two.
describe('segments', () => {
  const joined = () => resend.addToSegment.mock.calls.map(([options]) => options);
  const left = () => resend.removeFromSegment.mock.calls.map(([options]) => options);
  const email = 'jane@example.com';

  it.each([
    ['tea', [TEA_SEGMENT]],
    ['coffee', [COFFEE_SEGMENT]],
    ['both', [TEA_SEGMENT, COFFEE_SEGMENT]],
  ])('puts a new %s signup in %j', async (interest, segments) => {
    await post({ email, interest });

    expect(joined()).toEqual(segments.map((segmentId) => ({ email, segmentId })));
  });

  it('puts a new signup with no interest in both, as it is saved with interest "both"', async () => {
    await post({ email });

    expect(joined()).toEqual([
      { email, segmentId: TEA_SEGMENT },
      { email, segmentId: COFFEE_SEGMENT },
    ]);
    expect(resend.removeFromSegment).not.toHaveBeenCalled();
  });

  it('follows the quiz drink answer', async () => {
    await post({ email, answers: { drink: 'coffee' }, source: 'quiz' });

    expect(joined()).toEqual([{ email, segmentId: COFFEE_SEGMENT }]);
  });

  it('moves a known contact whose interest changed to one drink out of the other segment', async () => {
    resend.createContact.mockResolvedValue(
      failure({ name: 'validation_error', statusCode: 409, message: 'Contact already exists.' }),
    );

    await post({ email, interest: 'tea' });

    expect(joined()).toEqual([{ email, segmentId: TEA_SEGMENT }]);
    expect(left()).toEqual([{ email, segmentId: COFFEE_SEGMENT }]);
  });

  it('leaves the segments of a known contact alone when this signup says no interest', async () => {
    resend.createContact.mockResolvedValue(
      failure({ name: 'validation_error', statusCode: 409, message: 'Contact already exists.' }),
    );

    await post({ email });

    expect(resend.addToSegment).not.toHaveBeenCalled();
    expect(resend.removeFromSegment).not.toHaveBeenCalled();
  });

  it.each([
    ['RESEND_SEGMENT_TEA', 'tea', COFFEE_SEGMENT],
    ['RESEND_SEGMENT_COFFEE', 'coffee', TEA_SEGMENT],
  ])('quietly skips a segment when %s is not set', async (name, _drink, other) => {
    const log = silenceErrorLog();
    vi.stubEnv(name, undefined);

    const res = await post({ email, interest: 'both' });

    expect(res.body).toEqual(SAVED);
    expect(joined()).toEqual([{ email, segmentId: other }]);
    expect(log).not.toHaveBeenCalled();
  });

  it('still answers ok, and logs it, when a segment cannot be changed', async () => {
    const log = silenceErrorLog();
    const error = { name: 'not_found', statusCode: 404, message: 'Segment not found' };
    resend.addToSegment.mockResolvedValue(failure(error));

    const res = await post({ email, interest: 'tea' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(SAVED);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]).toContain(error);
    expect(JSON.stringify(log.mock.calls)).not.toContain('jane@');
  });

  it('still answers ok, and logs it, when a segment call throws', async () => {
    const log = silenceErrorLog();
    const thrown = new Error('socket hang up');
    resend.addToSegment.mockRejectedValue(thrown);

    const res = await post({ email, interest: 'tea' });

    expect(res.body).toEqual(SAVED);
    expect(log.mock.calls[0]).toContain(thrown);
  });

  it('does not count a contact that is already in the segment as a problem', async () => {
    const log = silenceErrorLog();
    resend.addToSegment.mockResolvedValue(
      failure({ name: 'validation_error', statusCode: 422, message: 'Contact already exists in segment' }),
    );

    const res = await post({ email, interest: 'tea' });

    expect(res.body).toEqual(SAVED);
    expect(log).not.toHaveBeenCalled();
  });

  it('does not count leaving a segment the contact was not in as a problem', async () => {
    const log = silenceErrorLog();
    resend.createContact.mockResolvedValue(
      failure({ name: 'validation_error', statusCode: 409, message: 'Contact already exists.' }),
    );
    resend.removeFromSegment.mockResolvedValue(
      failure({ name: 'not_found', statusCode: 404, message: 'Contact not in segment' }),
    );

    const res = await post({ email, interest: 'coffee' });

    expect(res.body).toEqual(SAVED);
    expect(log).not.toHaveBeenCalled();
  });

  it('waits and tries a segment once more when Resend says to slow down', async () => {
    vi.useFakeTimers();
    try {
      resend.addToSegment.mockResolvedValueOnce(
        failure({ name: 'rate_limit_exceeded', statusCode: 429, message: 'Too many requests' }),
      );

      const pending = post({ email, interest: 'tea' });
      await vi.advanceTimersByTimeAsync(1000);
      const res = await pending;

      expect(res.body).toEqual(SAVED);
      expect(resend.addToSegment).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('touches no segment when the contact could not be saved', async () => {
    silenceErrorLog();
    resend.createContact.mockResolvedValue(
      failure({ name: 'rate_limit_exceeded', statusCode: 429, message: 'Too many requests' }),
    );

    await post({ email, interest: 'tea' });

    expect(resend.addToSegment).not.toHaveBeenCalled();
    expect(resend.removeFromSegment).not.toHaveBeenCalled();
  });
});

// resend v6 types no error code for a contact that already exists and passes the
// API's own error body through, so the handler recognizes one by its status (409)
// or its message.
describe('an address that is already on the list', () => {
  it.each([
    [
      'says the contact already exists',
      { name: 'validation_error', statusCode: 422, message: 'Contact already exists.' },
    ],
    [
      'says so in capitals',
      { name: 'validation_error', statusCode: 400, message: 'THIS CONTACT ALREADY EXISTS IN THE AUDIENCE' },
    ],
    [
      'is a 409 Conflict',
      { name: 'validation_error', statusCode: 409, message: 'Conflict' },
    ],
  ])('counts a Resend error that %s as a successful signup', async (_case, error) => {
    const log = silenceErrorLog();
    resend.createContact.mockResolvedValue(failure(error));

    const res = await post({ email: 'jane@example.com' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(SAVED);
    expect(log).not.toHaveBeenCalled();
  });
});

describe('when Resend fails', () => {
  it.each([
    [
      'a rate limit',
      { name: 'rate_limit_exceeded', statusCode: 429, message: 'Too many requests' },
    ],
    [
      'a rejected API key',
      { name: 'invalid_api_key', statusCode: 403, message: 'API key is invalid' },
    ],
    [
      'an audience that does not exist',
      { name: 'not_found', statusCode: 404, message: 'Audience does not exist.' },
    ],
    [
      'a validation error',
      { name: 'validation_error', statusCode: 422, message: 'The email field must be a valid email.' },
    ],
    [
      'a network failure',
      {
        name: 'application_error',
        statusCode: null,
        message: 'Unable to fetch data. The request could not be resolved.',
      },
    ],
  ])('answers 500 and logs the error when Resend returns %s', async (_case, error) => {
    const log = silenceErrorLog();
    resend.createContact.mockResolvedValue(failure(error));

    const res = await post({ email: 'jane@example.com' });

    // The body is the same generic one for every cause, so no detail reaches the visitor.
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual(FAILED);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]).toContain(error);
  });

  it.each([
    ['an Error', new Error('socket hang up')],
    ['nothing at all', undefined],
  ])('answers 500 and logs it when contacts.create throws %s', async (_case, thrown) => {
    const log = silenceErrorLog();
    resend.createContact.mockRejectedValue(thrown);

    const res = await post({ email: 'jane@example.com' });

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual(FAILED);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]).toContain(thrown);
  });

  it('answers 500 and logs it when the Resend client cannot be created', async () => {
    const log = silenceErrorLog();
    const thrown = new Error('Missing API key.');
    resend.Resend.mockImplementation(function () {
      throw thrown;
    });

    const res = await post({ email: 'jane@example.com' });

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual(FAILED);
    expect(log.mock.calls[0]).toContain(thrown);
    expect(resend.createContact).not.toHaveBeenCalled();
  });

  it("keeps the visitor's address out of the server log", async () => {
    const log = silenceErrorLog();
    const email = 'private.person@example.com';
    resend.createContact.mockResolvedValueOnce(
      failure({ name: 'rate_limit_exceeded', statusCode: 429, message: 'Too many requests' }),
    );
    await post({ email });
    vi.stubEnv('RESEND_AUDIENCE_ID', undefined);
    await post({ email });

    expect(log).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(log.mock.calls)).not.toContain('private.person');
  });
});

describe('when Resend is not set up', () => {
  const NAMES = ['RESEND_API_KEY', 'RESEND_AUDIENCE_ID'];

  it.each([
    ['RESEND_API_KEY is unset', { RESEND_API_KEY: undefined }, ['RESEND_API_KEY']],
    ['RESEND_AUDIENCE_ID is unset', { RESEND_AUDIENCE_ID: undefined }, ['RESEND_AUDIENCE_ID']],
    ['RESEND_API_KEY is blank', { RESEND_API_KEY: '' }, ['RESEND_API_KEY']],
    ['RESEND_AUDIENCE_ID is blank', { RESEND_AUDIENCE_ID: '' }, ['RESEND_AUDIENCE_ID']],
    [
      'both are unset',
      { RESEND_API_KEY: undefined, RESEND_AUDIENCE_ID: undefined },
      ['RESEND_API_KEY', 'RESEND_AUDIENCE_ID'],
    ],
  ])('answers 500 and logs which setting is missing when %s', async (_case, env, missing) => {
    const log = silenceErrorLog();
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);

    const res = await post({ email: 'jane@example.com' });

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual(FAILED);
    expect(log).toHaveBeenCalledTimes(1);
    const line = log.mock.calls[0][0];
    for (const name of NAMES) {
      if (missing.includes(name)) expect(line).toContain(name);
      else expect(line).not.toContain(name);
    }
    expect(resend.Resend).not.toHaveBeenCalled();
    expect(resend.createContact).not.toHaveBeenCalled();
  });

  it('still answers 400, not 500, to a bad email', async () => {
    silenceErrorLog();
    vi.stubEnv('RESEND_AUDIENCE_ID', undefined);

    const res = await post({ email: 'not-an-email' });

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual(INVALID);
  });
});

describe('the request method', () => {
  it.each(['GET', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])('answers 405 to %s', async (method) => {
    const res = await post({ email: 'jane@example.com' }, { method });

    expect(res.statusCode).toBe(405);
    expect(res.body).toEqual({ error: 'Method not allowed' });
    expect(resend.Resend).not.toHaveBeenCalled();
    expect(resend.createContact).not.toHaveBeenCalled();
  });
});
