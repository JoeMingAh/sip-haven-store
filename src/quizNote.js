import { cleanAnswers } from '../lib/quiz.js';

/**
 * Tells /api/quiz-notes that the quiz could not fully answer these answers: `picks` is
 * how many products it found. Only the answer ids and that count are sent. Fire and
 * forget: nothing is awaited, and a failure of any kind is swallowed, because the
 * shopper must never see an error for it. keepalive lets the request finish even if the
 * shopper leaves the page straight away.
 */
export function sendQuizNote(answers, picks) {
  try {
    fetch('/api/quiz-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...cleanAnswers(answers), picks }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // fetch itself threw (no fetch at all, say). Nothing to tell the shopper.
  }
}
