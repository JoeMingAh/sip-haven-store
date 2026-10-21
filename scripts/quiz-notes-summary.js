// Counts the quiz notes (see lib/quiz-notes.js) for the weekly summary: every note
// saved in the last N days, grouped by answer combination, most common first, then
// counted by mood, by flavor and by aroma on their own, so unmet demand for each shows
// up even when the combinations are spread thin. The notes are anonymous: answers and
// a picks count only.
//
//   npm run quiz-notes:summary            the last 7 days, today included (UTC days)
//   npm run quiz-notes:summary -- 30      the last 30 days
//
// It reads BLOB_READ_WRITE_TOKEN from .env.local (`vercel env pull .env.local` gets it)
// and only reads from the store: nothing is changed or deleted.
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { get, list } from '@vercel/blob';
import { NOTES_FOLDER, NOTE_ANSWER_FIELDS, dayOf } from '../lib/quiz-notes.js';

export const DEFAULT_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const USAGE = 'Usage: npm run quiz-notes:summary [-- <days>]   (days is a whole number, 1 or more)';

const count = (number, word) => `${number} ${word}${number === 1 ? '' : 's'}`;

// The questions the summary also counts on their own, with their headings, in quiz order.
const PER_ANSWER = [
  ['mood', 'By mood'],
  ['flavor', 'By flavor'],
  ['aroma', 'By aroma'],
];

// A note's answer to one question, or '-' when it has none (a note saved before that
// question was asked, say).
const answerOf = (note, field) => (typeof note[field] === 'string' ? note[field] : '-');

// Most common first, ties in alphabetical order of `key` so the output is stable.
const byCount = (key) => (a, b) => b.count - a.count || key(a).localeCompare(key(b));

/** The folder prefix of each of the last `days` UTC days, today first. */
export function dayPrefixes(days, now = new Date()) {
  return Array.from(
    { length: days },
    (_, back) => `${NOTES_FOLDER}/${dayOf(new Date(now.getTime() - back * DAY_MS))}/`,
  );
}

/** Every blob under each prefix, following the pages `list` hands back. */
export async function listNotes(prefixes, listBlobs = list) {
  const blobs = [];
  for (const prefix of prefixes) {
    let cursor;
    do {
      const page = await listBlobs({ prefix, cursor });
      blobs.push(...page.blobs);
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
  }
  return blobs;
}

/** One private note, parsed. null when it is gone or is not a JSON object. */
export async function readNote(pathname, getBlob = get) {
  const result = await getBlob(pathname, { access: 'private', useCache: false });
  if (!result || result.statusCode !== 200) return null;
  try {
    const note = await new Response(result.stream).json();
    return typeof note === 'object' && note !== null && !Array.isArray(note) ? note : null;
  } catch {
    return null;
  }
}

/**
 * The notes grouped by all their answers: [{ answers, count }], most common first,
 * ties in alphabetical order of the combination so the output is stable. An answer
 * that is missing reads as '-'.
 */
export function countCombos(notes) {
  const rows = new Map();
  for (const note of notes) {
    const answers = Object.fromEntries(NOTE_ANSWER_FIELDS.map((field) => [field, answerOf(note, field)]));
    const key = comboText(answers);
    const row = rows.get(key) ?? { answers, count: 0 };
    row.count += 1;
    rows.set(key, row);
  }
  return [...rows.values()].sort(byCount((row) => comboText(row.answers)));
}

// 'tea / calm / none / floral / citrus / ritual'
const comboText = (answers) => NOTE_ANSWER_FIELDS.map((field) => answers[field]).join(' / ');

/**
 * The notes counted by their answer to one question (`field`, like 'flavor'):
 * [{ answer, count }], most common first, ties alphabetical. No answer reads as '-'.
 */
export function countAnswers(notes, field) {
  const counts = new Map();
  for (const note of notes) {
    const answer = answerOf(note, field);
    counts.set(answer, (counts.get(answer) ?? 0) + 1);
  }
  return [...counts]
    .map(([answer, number]) => ({ answer, count: number }))
    .sort(byCount((row) => row.answer));
}

const countLine = (number, text) => `${String(number).padStart(5)}  ${text}`;

/** The printed summary of these notes, as lines. */
export function formatSummary(notes, { days }) {
  const lines = [`Quiz notes, last ${count(days, 'day')}: ${count(notes.length, 'note')}`];
  if (notes.length === 0) return lines;

  lines.push('', `count  ${NOTE_ANSWER_FIELDS.join(' / ')}`);
  for (const row of countCombos(notes)) lines.push(countLine(row.count, comboText(row.answers)));

  for (const [field, heading] of PER_ANSWER) {
    lines.push('', heading);
    for (const row of countAnswers(notes, field)) lines.push(countLine(row.count, row.answer));
  }
  return lines;
}

/**
 * Runs the summary. `io` is for tests: by default it reads the environment, uses the
 * real Blob store and prints to the console.
 * @returns {Promise<number>} the exit code
 */
export async function runCli(args, io = {}) {
  const {
    env = process.env,
    now = new Date(),
    listBlobs = list,
    getBlob = get,
    log = console.log,
    logError = console.error,
  } = io;

  if (args.length > 1 || (args.length === 1 && !/^[1-9]\d*$/.test(args[0]))) {
    logError(USAGE);
    return 1;
  }
  const days = args.length === 1 ? Number(args[0]) : DEFAULT_DAYS;

  if (!env.BLOB_READ_WRITE_TOKEN) {
    logError(
      'BLOB_READ_WRITE_TOKEN is not set. Run `vercel env pull .env.local` (or put the token in ' +
        '.env.local yourself), then run this again.',
    );
    return 1;
  }

  try {
    const blobs = await listNotes(dayPrefixes(days, now), listBlobs);
    const notes = [];
    for (const { pathname } of blobs) {
      const note = await readNote(pathname, getBlob);
      if (note) notes.push(note);
    }
    for (const line of formatSummary(notes, { days })) log(line);
    return 0;
  } catch (error) {
    logError(`Could not read the quiz notes from Blob: ${error?.message ?? error}`);
    return 1;
  }
}

// True when this file is the one being run (node scripts/quiz-notes-summary.js), not imported.
function isRunDirectly() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isRunDirectly()) {
  runCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
