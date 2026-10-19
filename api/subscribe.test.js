import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from './subscribe.js';

// No test here can reach Resend. The resend module is replaced by a fake whose
// methods are spies, so the tests can see what the handler asked for. Signing up
// must only ever add a contact, so the ways to send mail are spies too, and the
// tests check that nothing used them.
const resend = vi.hoisted(() => {
  const createContact = vi.fn();
  const sendEmail = vi.fn();
  const sendBatch = vi.fn();
  // A plain function, not an arrow function, because the handler calls it with `new`.
  const Resend = vi.fn(function () {
    this.contacts = { create: createContact };
    this.emails = { send: sendEmail };
    this.batch = { send: sendBatch };
  });
  return { Resend, createContact, sendEmail, sendBatch };
});
vi.mock('resend', () => ({ Resend: resend.Resend }));

const API_KEY = 're_fake';
const AUDIENCE_ID = 'aud_test_123';

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

beforeEach(() => {
  vi.stubEnv('RESEND_API_KEY', API_KEY);
  vi.stubEnv('RESEND_AUDIENCE_ID', AUDIENCE_ID);
  resend.Resend.mockReset();
  resend.createContact.mockReset();
  resend.sendEmail.mockReset();
  resend.sendBatch.mockReset();
  resend.createContact.mockResolvedValue({
    data: { object: 'contact', id: 'contact_1' },
    error: null,
    headers: null,
  });
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

// The form may send `interest`. It is accepted and left unsaved: Resend only keeps
// a custom contact property that has been created in the account first.
describe('interest', () => {
  it.each(['tea', 'coffee', 'both'])('accepts "%s" and leaves it out of the Resend call', async (interest) => {
    const res = await post({ email: 'jane@example.com', interest });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(SAVED);
    expect(resend.createContact).toHaveBeenCalledWith({
      email: 'jane@example.com',
      audienceId: AUDIENCE_ID,
      unsubscribed: false,
    });
  });

  it.each([
    ['a word that is not an option', 'wine'],
    ['an empty string', ''],
    ['a number', 7],
    ['null', null],
    ['an array', ['tea']],
    ['an object', { tea: true }],
  ])('ignores an interest that is %s instead of refusing the signup', async (_case, interest) => {
    const res = await post({ email: 'jane@example.com', interest });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(SAVED);
    expect(resend.createContact).toHaveBeenCalledTimes(1);
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
