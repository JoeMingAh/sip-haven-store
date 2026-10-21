// Quiz notes: an anonymous record of quiz answers that the lineup could not fully
// answer (no picks, or fewer than the quiz shows), kept as ideas for future products.
// /api/quiz-notes writes them to Vercel Blob and scripts/quiz-notes-summary.js counts
// them. A note holds the answer ids (one per quiz question, so the flavor and the aroma
// that went unmet are in it), the number of picks and whether the store was open:
// never an email, an IP address or a user agent.
import { MAX_RECOMMENDATIONS, QUIZ_QUESTIONS, cleanAnswers } from './quiz.js';

/** The folder in the Blob store that holds the notes, one subfolder per day. */
export const NOTES_FOLDER = 'quiz-notes';

/** The largest request body /api/quiz-notes accepts, in bytes. */
export const MAX_NOTE_BYTES = 1024;

/** The question ids, in quiz order: the fields of a note that hold answers. */
export const NOTE_ANSWER_FIELDS = QUIZ_QUESTIONS.map((question) => question.id);

/**
 * The note for a request body `{ drink, caffeine, flavor, aroma, style, picks }`, or null when
 * the body cannot make one: no valid answer at all, or a `picks` that is not a whole
 * number from 0 to MAX_RECOMMENDATIONS. An answer id that is not one of its question's
 * answers is stored as null, like one that was not sent. Nothing else from the body is
 * kept. `storeOpen` is the server's own setting, not the shopper's.
 */
export function noteFrom(body, { storeOpen }) {
  const answers = cleanAnswers(body);
  const picks = body?.picks;
  if (Object.keys(answers).length === 0) return null;
  if (!Number.isInteger(picks) || picks < 0 || picks > MAX_RECOMMENDATIONS) return null;

  const note = {};
  for (const field of NOTE_ANSWER_FIELDS) note[field] = answers[field] ?? null;
  note.picks = picks;
  note.storeOpen = storeOpen === true;
  return note;
}

/** 'YYYY-MM-DD' for a date, in UTC. */
export const dayOf = (date) => date.toISOString().slice(0, 10);

/** Where a note goes: quiz-notes/YYYY-MM-DD/<id>.json, the day in UTC. */
export function notePathname(date, id) {
  return `${NOTES_FOLDER}/${dayOf(date)}/${id}.json`;
}
