import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from './quiz-notes.js';

// No test here can reach Vercel Blob: @vercel/blob is replaced by a fake whose `put`
// is a spy, so the tests can see exactly what would have been stored.
const blob = vi.hoisted(() => ({ put: vi.fn() }));
vi.mock('@vercel/blob', () => ({ put: blob.put }));

const NOTE = {
  drink: 'tea',
  caffeine: 'none',
  flavor: 'floral',
  aroma: 'citrus',
  style: 'ritual',
  picks: 0,
};
const SAVED = { ok: true };
const UUID_JSON = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/;

// Run the handler once and hand back what it answered.
async function post(body, { method = 'POST', headers = {} } = {}) {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  await handler({ method, headers, body }, res);
  return res;
}

// What the one put call stored: its pathname, the parsed note and its options.
function stored() {
  const [pathname, json, options] = blob.put.mock.calls[0];
  return { pathname, note: JSON.parse(json), json, options };
}

const silenceErrorLog = () => vi.spyOn(console, 'error').mockImplementation(() => {});

beforeEach(() => {
  vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_fake');
  vi.stubEnv('STORE_OPEN', 'false');
  blob.put.mockReset();
  blob.put.mockResolvedValue({ pathname: 'quiz-notes/x.json' });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('saving a note', () => {
  it('writes one private JSON note and answers ok', async () => {
    const res = await post(NOTE);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(SAVED);
    expect(blob.put).toHaveBeenCalledTimes(1);
    expect(stored().options).toEqual({
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: false,
    });
  });

  it('stores the five answers, the picks count and whether the store was open', async () => {
    await post({ ...NOTE, picks: 2 });

    expect(stored().note).toEqual({
      drink: 'tea',
      caffeine: 'none',
      flavor: 'floral',
      aroma: 'citrus',
      style: 'ritual',
      picks: 2,
      storeOpen: false,
    });
  });

  it('keeps the flavor and the aroma of a no-match quiz', async () => {
    await post({ drink: 'coffee', flavor: 'fruity', aroma: 'fresh', picks: 0 });

    expect(stored().note).toMatchObject({ flavor: 'fruity', aroma: 'fresh', picks: 0 });
  });

  it('records the store as open from the server setting', async () => {
    vi.stubEnv('STORE_OPEN', 'true');
    await post(NOTE);
    expect(stored().note.storeOpen).toBe(true);
  });

  it('files it under quiz-notes/<UTC day>/<uuid>.json', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-20T23:30:00-07:00')); // already the 21st in UTC

    await post(NOTE);

    const [folder, day, file] = stored().pathname.split('/');
    expect(folder).toBe('quiz-notes');
    expect(day).toBe('2026-10-21');
    expect(file).toMatch(UUID_JSON);
  });

  it('gives every note its own file', async () => {
    await post(NOTE);
    await post(NOTE);
    expect(blob.put.mock.calls[0][0]).not.toBe(blob.put.mock.calls[1][0]);
  });
});

describe('no personal data', () => {
  it('stores no email, IP address, user agent or any other field that was sent', async () => {
    await post(
      {
        ...NOTE,
        email: 'jane@example.com',
        ip: '203.0.113.9',
        userAgent: 'Mozilla/5.0',
        name: 'Jane',
      },
      {
        headers: {
          'x-forwarded-for': '203.0.113.9',
          'x-real-ip': '203.0.113.9',
          'user-agent': 'Mozilla/5.0 (Test)',
        },
      },
    );

    const { note, json, pathname } = stored();
    expect(Object.keys(note).sort()).toEqual(
      ['aroma', 'caffeine', 'drink', 'flavor', 'picks', 'storeOpen', 'style'].sort(),
    );
    for (const text of [json, pathname]) {
      expect(text).not.toContain('jane');
      expect(text).not.toContain('203.0.113.9');
      expect(text).not.toContain('Mozilla');
    }
  });
});

describe('validation', () => {
  it('stores an unknown answer id as null and keeps the rest', async () => {
    const res = await post({ ...NOTE, caffeine: 'extreme', aroma: 'lemon', style: '<script>' });

    expect(res.statusCode).toBe(200);
    expect(stored().note).toMatchObject({
      drink: 'tea',
      caffeine: null,
      flavor: 'floral',
      aroma: null,
      style: null,
    });
  });

  it.each([
    ['no valid answer at all', { drink: 'soda', caffeine: 'x', picks: 0 }],
    ['only picks', { picks: 0 }],
    ['picks missing', { drink: 'tea' }],
    ['picks below 0', { ...NOTE, picks: -1 }],
    ['picks above the most the quiz shows', { ...NOTE, picks: 4 }],
    ['picks that is not whole', { ...NOTE, picks: 1.5 }],
    ['picks as text', { ...NOTE, picks: '0' }],
    ['no body', undefined],
    ['a null body', null],
    ['an array', [NOTE]],
    ['a body that was not parsed as JSON', 'drink=tea'],
  ])('answers 400 to %s and stores nothing', async (_case, body) => {
    const res = await post(body);

    expect(res.statusCode).toBe(400);
    expect(blob.put).not.toHaveBeenCalled();
  });

  it('answers 413 to a body over 1 KB and stores nothing', async () => {
    const res = await post({ ...NOTE, padding: 'x'.repeat(1100) });

    expect(res.statusCode).toBe(413);
    expect(blob.put).not.toHaveBeenCalled();
  });

  it('answers 413 when the Content-Length header says more than 1 KB', async () => {
    const res = await post(NOTE, { headers: { 'content-length': '1025' } });

    expect(res.statusCode).toBe(413);
    expect(blob.put).not.toHaveBeenCalled();
  });

  it('accepts a body of exactly 1 KB', async () => {
    const res = await post(NOTE, { headers: { 'content-length': '1024' } });
    expect(res.statusCode).toBe(200);
  });

  it.each(['GET', 'PUT', 'DELETE'])('answers 405 to %s', async (method) => {
    const res = await post(NOTE, { method });

    expect(res.statusCode).toBe(405);
    expect(blob.put).not.toHaveBeenCalled();
  });
});

describe('failures', () => {
  it('answers 500 and logs the setting name when BLOB_READ_WRITE_TOKEN is not set', async () => {
    const log = silenceErrorLog();
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', '');

    const res = await post(NOTE);

    expect(res.statusCode).toBe(500);
    expect(log.mock.calls[0][0]).toContain('BLOB_READ_WRITE_TOKEN');
    expect(blob.put).not.toHaveBeenCalled();
  });

  it('answers 500 and logs it when Blob fails', async () => {
    const log = silenceErrorLog();
    const thrown = new Error('Blob store unavailable');
    blob.put.mockRejectedValue(thrown);

    const res = await post(NOTE);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'Something went wrong.' });
    expect(log.mock.calls[0]).toContain(thrown);
  });
});
