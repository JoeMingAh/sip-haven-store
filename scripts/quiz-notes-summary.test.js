import { describe, it, expect, vi } from 'vitest';
import {
  countAnswers,
  countCombos,
  dayPrefixes,
  formatSummary,
  listNotes,
  readNote,
  runCli,
} from './quiz-notes-summary.js';

// None of these tests can reach Vercel Blob: runCli and the helpers are handed a
// pretend store (fakeStore below) in place of @vercel/blob's list and get.

const note = (drink, caffeine, flavor, aroma, style, picks = 0) => ({
  drink,
  caffeine,
  flavor,
  aroma,
  style,
  picks,
  storeOpen: true,
});

// Two notes that come up again and again below.
const TEA = () => note('tea', 'none', 'floral', 'citrus', 'ritual');
const COFFEE = () => note('coffee', 'high', 'earthy', 'toasty', 'quick');

// A get() result for a note, the way @vercel/blob hands one back: a stream of its JSON.
const found = (value) => ({
  statusCode: 200,
  stream: new Response(typeof value === 'string' ? value : JSON.stringify(value)).body,
});

// A store holding `files` ({ pathname: note }). list() pages through matching paths
// `pageSize` at a time, like the real one does with its cursor.
function fakeStore(files, { pageSize = 1000 } = {}) {
  const listBlobs = vi.fn(async ({ prefix, cursor }) => {
    const matching = Object.keys(files).filter((pathname) => pathname.startsWith(prefix));
    const start = cursor ? Number(cursor) : 0;
    const blobs = matching.slice(start, start + pageSize).map((pathname) => ({ pathname }));
    const hasMore = start + pageSize < matching.length;
    return { blobs, hasMore, cursor: hasMore ? String(start + pageSize) : undefined };
  });
  const getBlob = vi.fn(async (pathname) => (pathname in files ? found(files[pathname]) : null));
  return { listBlobs, getBlob };
}

const NOW = new Date('2026-10-20T12:00:00Z');

describe('dayPrefixes', () => {
  it('lists the last N UTC days, today first', () => {
    expect(dayPrefixes(3, NOW)).toEqual([
      'quiz-notes/2026-10-20/',
      'quiz-notes/2026-10-19/',
      'quiz-notes/2026-10-18/',
    ]);
  });

  it('crosses month ends', () => {
    expect(dayPrefixes(2, new Date('2026-11-01T00:30:00Z'))).toEqual([
      'quiz-notes/2026-11-01/',
      'quiz-notes/2026-10-31/',
    ]);
  });
});

describe('listNotes', () => {
  it('follows every page of every day', async () => {
    const store = fakeStore(
      {
        'quiz-notes/2026-10-20/a.json': TEA(),
        'quiz-notes/2026-10-20/b.json': TEA(),
        'quiz-notes/2026-10-20/c.json': TEA(),
        'quiz-notes/2026-10-19/d.json': TEA(),
      },
      { pageSize: 2 },
    );

    const blobs = await listNotes(dayPrefixes(2, NOW), store.listBlobs);

    expect(blobs.map((blob) => blob.pathname)).toEqual([
      'quiz-notes/2026-10-20/a.json',
      'quiz-notes/2026-10-20/b.json',
      'quiz-notes/2026-10-20/c.json',
      'quiz-notes/2026-10-19/d.json',
    ]);
    expect(store.listBlobs).toHaveBeenCalledTimes(3);
  });
});

describe('readNote', () => {
  it('reads a private note', async () => {
    const getBlob = vi.fn(async () => found(COFFEE()));

    expect(await readNote('quiz-notes/2026-10-20/a.json', getBlob)).toEqual(COFFEE());
    expect(getBlob).toHaveBeenCalledWith('quiz-notes/2026-10-20/a.json', {
      access: 'private',
      useCache: false,
    });
  });

  it.each([
    ['a note that is gone', null],
    ['a file that is not JSON', found('not json')],
    ['JSON that is not an object', found('[1, 2]')],
  ])('gives null for %s', async (_case, result) => {
    expect(await readNote('x.json', async () => result)).toBeNull();
  });
});

describe('countCombos', () => {
  it('counts each answer combination, most common first', () => {
    const rows = countCombos([
      COFFEE(),
      TEA(),
      note('tea', 'none', 'floral', 'citrus', 'ritual', 2),
      TEA(),
      COFFEE(),
      note('either', 'low', 'fruity', 'either', 'either'),
    ]);

    expect(rows).toEqual([
      {
        answers: { drink: 'tea', caffeine: 'none', flavor: 'floral', aroma: 'citrus', style: 'ritual' },
        count: 3,
      },
      {
        answers: { drink: 'coffee', caffeine: 'high', flavor: 'earthy', aroma: 'toasty', style: 'quick' },
        count: 2,
      },
      {
        answers: { drink: 'either', caffeine: 'low', flavor: 'fruity', aroma: 'either', style: 'either' },
        count: 1,
      },
    ]);
  });

  it('tells apart notes that differ only in their aroma', () => {
    const rows = countCombos([TEA(), note('tea', 'none', 'floral', 'fresh', 'ritual')]);
    expect(rows.map((row) => row.answers.aroma)).toEqual(['citrus', 'fresh']);
  });

  it('puts ties in a stable alphabetical order', () => {
    const rows = countCombos([
      note('tea', 'low', 'fruity', 'sweet', 'quick'),
      note('coffee', 'low', 'fruity', 'sweet', 'quick'),
    ]);
    expect(rows.map((row) => row.answers.drink)).toEqual(['coffee', 'tea']);
  });

  it('shows a missing answer as "-", like the aroma of a note from before it was asked', () => {
    expect(countCombos([{ drink: 'tea', caffeine: null, flavor: 'floral', style: 'quick', picks: 0 }])).toEqual([
      {
        answers: { drink: 'tea', caffeine: '-', flavor: 'floral', aroma: '-', style: 'quick' },
        count: 1,
      },
    ]);
  });

  it('gives no rows for no notes', () => {
    expect(countCombos([])).toEqual([]);
  });
});

describe('countAnswers', () => {
  const notes = [
    TEA(),
    COFFEE(),
    note('tea', 'low', 'floral', 'fresh', 'quick'),
    note('either', 'low', 'fruity', 'citrus', 'either'),
    { drink: 'tea', picks: 0 },
  ];

  it('counts the notes by flavor, most common first', () => {
    expect(countAnswers(notes, 'flavor')).toEqual([
      { answer: 'floral', count: 2 },
      { answer: '-', count: 1 },
      { answer: 'earthy', count: 1 },
      { answer: 'fruity', count: 1 },
    ]);
  });

  it('counts the notes by aroma, most common first', () => {
    expect(countAnswers(notes, 'aroma')).toEqual([
      { answer: 'citrus', count: 2 },
      { answer: '-', count: 1 },
      { answer: 'fresh', count: 1 },
      { answer: 'toasty', count: 1 },
    ]);
  });

  it('gives no rows for no notes', () => {
    expect(countAnswers([], 'aroma')).toEqual([]);
  });
});

describe('formatSummary', () => {
  it('prints the total, one line per combination, then the flavor and aroma counts', () => {
    const notes = [TEA(), TEA(), COFFEE(), note('tea', 'none', 'floral', 'fresh', 'ritual')];
    expect(formatSummary(notes, { days: 7 })).toEqual([
      'Quiz notes, last 7 days: 4 notes',
      '',
      'count  drink / caffeine / flavor / aroma / style',
      '    2  tea / none / floral / citrus / ritual',
      '    1  coffee / high / earthy / toasty / quick',
      '    1  tea / none / floral / fresh / ritual',
      '',
      'By flavor',
      '    3  floral',
      '    1  earthy',
      '',
      'By aroma',
      '    2  citrus',
      '    1  fresh',
      '    1  toasty',
    ]);
  });

  it('says so when there are none', () => {
    expect(formatSummary([], { days: 1 })).toEqual(['Quiz notes, last 1 day: 0 notes']);
  });
});

describe('runCli', () => {
  const env = { BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_fake' };
  const files = {
    'quiz-notes/2026-10-20/a.json': TEA(),
    'quiz-notes/2026-10-14/b.json': TEA(),
    // Eight days back: outside the default week.
    'quiz-notes/2026-10-13/c.json': COFFEE(),
    'other/2026-10-20/d.json': COFFEE(),
  };

  async function run(args, overrides = {}) {
    const log = vi.fn();
    const logError = vi.fn();
    const code = await runCli(args, { env, now: NOW, ...fakeStore(files), log, logError, ...overrides });
    return { code, out: log.mock.calls.map(([line]) => line), errors: logError.mock.calls.map(([line]) => line) };
  }

  it('counts the notes of the last 7 days by default', async () => {
    const { code, out } = await run([]);

    expect(code).toBe(0);
    expect(out).toEqual([
      'Quiz notes, last 7 days: 2 notes',
      '',
      'count  drink / caffeine / flavor / aroma / style',
      '    2  tea / none / floral / citrus / ritual',
      '',
      'By flavor',
      '    2  floral',
      '',
      'By aroma',
      '    2  citrus',
    ]);
  });

  it('takes the number of days as its argument', async () => {
    const { out } = await run(['8']);

    expect(out[0]).toBe('Quiz notes, last 8 days: 3 notes');
    expect(out).toContain('    1  coffee / high / earthy / toasty / quick');
    expect(out).toContain('    1  toasty');
  });

  it('counts a single no-match note, with its flavor and aroma', async () => {
    const { out } = await run(['1'], fakeStore({ 'quiz-notes/2026-10-20/a.json': TEA() }));

    expect(out[0]).toBe('Quiz notes, last 1 day: 1 note');
    expect(out[3]).toBe('    1  tea / none / floral / citrus / ritual');
    expect(out.slice(4)).toEqual(['', 'By flavor', '    1  floral', '', 'By aroma', '    1  citrus']);
  });

  it.each([['0'], ['-3'], ['seven'], ['1.5'], ['7', '8']])('refuses the arguments %j', async (...args) => {
    const { code, errors } = await run(args);

    expect(code).toBe(1);
    expect(errors[0]).toMatch(/^Usage:/);
  });

  it('asks for BLOB_READ_WRITE_TOKEN when it is not set, and reads nothing', async () => {
    const store = fakeStore(files);
    const { code, errors } = await run([], { env: {}, ...store });

    expect(code).toBe(1);
    expect(errors[0]).toContain('BLOB_READ_WRITE_TOKEN');
    expect(store.listBlobs).not.toHaveBeenCalled();
  });

  it('reports a Blob failure', async () => {
    const { code, errors } = await run([], {
      listBlobs: async () => {
        throw new Error('Access denied');
      },
    });

    expect(code).toBe(1);
    expect(errors[0]).toContain('Access denied');
  });
});
