import { Resend } from 'resend';
import { contactProperties, readSignup, segmentsFor } from '../lib/signup.js';

// The longest address a mail server accepts (RFC 5321 allows 254 characters).
const MAX_EMAIL_LENGTH = 254;

// Deliberately simple: no spaces, one @, and a dot in the domain with something
// after it. It catches typos. Resend does the stricter checking.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const GENERIC_FAILURE = 'Something went wrong. Please try again.';

// The address trimmed and lowercased, or null when it is not an acceptable address.
function normalizeEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  // The length goes first so the pattern never has to read a huge string.
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) return null;
  return email;
}

// Resend's typings have no error code for a contact that already exists, and the
// SDK hands back the API's own error body as it came, so a duplicate is
// recognized by what it says: a 409 Conflict, or a message that says the contact
// "already exists". Errors such as "Audience does not exist" are not duplicates.
function isDuplicateContact(error) {
  return error.statusCode === 409 || /already\s+exist/i.test(error.message ?? '');
}

// The segment for each interest, by the setting that holds its id. A segment whose
// setting is missing is skipped without a word: segments are optional.
const SEGMENT_SETTINGS = { tea: 'RESEND_SEGMENT_TEA', coffee: 'RESEND_SEGMENT_COFFEE' };

// Resend allows a few requests a second per account, and one signup can make up to four
// (create, update, two segments). A follow-up call that is turned away for the rate
// waits this long and tries once more. The first call is not retried: nothing of ours
// came before it.
const RATE_LIMIT_WAIT_MS = 1000;

async function retryingOnRateLimit(call) {
  const result = await call();
  if (result?.error?.statusCode !== 429) return result;
  await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_WAIT_MS));
  return call();
}

// Puts the contact in the segments its interest calls for and takes it out of the one
// it no longer fits. The contact is saved by now, so a segment that cannot be changed is
// logged and the signup still counts. Adding to a segment it is already in, or taking it
// out of one it is not in, is not a problem.
async function updateSegments(resend, email, interest) {
  const { join, leave } = segmentsFor(interest);
  const segmentId = (drink) => process.env[SEGMENT_SETTINGS[drink]];

  for (const drink of join.filter(segmentId)) {
    const { error } = await retryingOnRateLimit(() =>
      resend.contacts.segments.add({ email, segmentId: segmentId(drink) }),
    );
    if (error && !isDuplicateContact(error)) {
      console.error(`Email signup could not be added to the ${drink} segment in Resend:`, error);
    }
  }
  for (const drink of leave.filter(segmentId)) {
    const { error } = await retryingOnRateLimit(() =>
      resend.contacts.segments.remove({ email, segmentId: segmentId(drink) }),
    );
    if (error && error.statusCode !== 404) {
      console.error(`Email signup could not be taken out of the ${drink} segment in Resend:`, error);
    }
  }
}

/**
 * POST /api/subscribe
 *   { email, interest?, answers?: { drink, caffeine, flavor, aroma, style }, topMatch?,
 *     matches?: [slug, ...], source? }
 *
 * Saves the visitor's address to the Resend audience, with what they told us as
 * contact properties (see lib/signup.js), and puts it in the tea and/or coffee segment.
 * An address that is already on the list has its properties updated instead, so
 * re-taking the quiz overwrites the old answers. Every field but the email is
 * optional, and a bad one is dropped rather than refused. It sends no email. It works
 * with the store open or closed, since the coming-soon shop is what collects these.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const email = normalizeEmail(req.body?.email);
  if (!email) {
    return res.status(400).json({ error: 'Please enter a valid email.' });
  }

  // `audienceId: undefined` would still make the SDK post to /audiences/undefined,
  // so a missing setting is stopped here. The log names the setting, never its value.
  const missing = ['RESEND_API_KEY', 'RESEND_AUDIENCE_ID'].filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.error(`Email signup is not set up: set ${missing.join(' and ')}.`);
    return res.status(500).json({ error: GENERIC_FAILURE });
  }

  // Resend and bug details stay in the server log. The visitor gets one generic
  // message, so nothing leaks. The visitor's address is left out of the log too.
  const fail = (detail) => {
    console.error('Email signup could not be saved to Resend:', detail);
    return res.status(500).json({ error: GENERIC_FAILURE });
  };

  const signup = readSignup(req.body);
  let resend;
  let existing;

  try {
    resend = new Resend(process.env.RESEND_API_KEY);
    // resend v6 hands a failed call back as { error } and does not throw. An address
    // that is already in the audience counts as signed up: the visitor is on the
    // list either way, and answering the same for new and known addresses does not
    // tell anyone who has signed up. Its properties are updated instead.
    const { error } = await resend.contacts.create({
      email,
      audienceId: process.env.RESEND_AUDIENCE_ID,
      unsubscribed: false,
      properties: contactProperties(signup),
    });
    if (error && !isDuplicateContact(error)) {
      return fail(error);
    }
    existing = Boolean(error);
    if (existing) {
      // Only `properties`: the visitor's subscribed or unsubscribed choice is left alone.
      // A failure here is answered like any other, so the visitor tries again and the
      // answers they just gave are not lost without a word.
      const { error: updateError } = await retryingOnRateLimit(() =>
        resend.contacts.update({ email, properties: contactProperties(signup, { existing }) }),
      );
      if (updateError) return fail(updateError);
    }
  } catch (err) {
    return fail(err);
  }

  // The contact is saved, so from here nothing fails the signup. A new contact with no
  // interest counts as 'both'; a known one keeps the segments it has.
  try {
    await updateSegments(resend, email, signup.interest ?? (existing ? null : 'both'));
  } catch (err) {
    console.error('Email signup could not be put in its Resend segments:', err);
  }

  return res.status(200).json({ ok: true });
}
