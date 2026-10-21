import { randomUUID } from 'node:crypto';
import { put } from '@vercel/blob';
import { MAX_NOTE_BYTES, noteFrom, notePathname } from '../lib/quiz-notes.js';
import { isStoreOpen } from '../lib/store-config.js';

const GENERIC_FAILURE = 'Something went wrong.';

// The size of the body: what the Content-Length header says, or, when that is missing
// (a chunked upload) or smaller, the body Vercel has already parsed, measured again as
// JSON. The larger of the two counts.
function bodySize(req) {
  const declared = Number(req.headers?.['content-length']) || 0;
  const body = req.body ?? '';
  const measured = Buffer.byteLength(typeof body === 'string' ? body : JSON.stringify(body));
  return Math.max(declared, measured);
}

/**
 * POST /api/quiz-notes  { drink, mood, caffeine, flavor, aroma, style, picks }
 *
 * Keeps an anonymous note of quiz answers the lineup could not fully answer (see
 * lib/quiz-notes.js), as one private JSON file in Vercel Blob. Only the answer ids and
 * the picks count are stored: no email, no IP address and no user agent, and nothing
 * from the request but those fields is read. Bodies over 1 KB are refused. The quiz
 * sends this and forgets it, so no answer here ever reaches the shopper.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (bodySize(req) > MAX_NOTE_BYTES) {
    return res.status(413).json({ error: 'Too large' });
  }

  const note = noteFrom(req.body, { storeOpen: isStoreOpen() });
  if (!note) {
    return res.status(400).json({ error: 'Not a quiz note' });
  }

  // The log names the setting, never its value.
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('Quiz notes are not set up: set BLOB_READ_WRITE_TOKEN.');
    return res.status(500).json({ error: GENERIC_FAILURE });
  }

  try {
    await put(notePathname(new Date(), randomUUID()), JSON.stringify(note), {
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: false,
    });
  } catch (err) {
    console.error('Quiz note could not be saved to Blob:', err);
    return res.status(500).json({ error: GENERIC_FAILURE });
  }

  return res.status(200).json({ ok: true });
}
