import { Resend } from 'resend';

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

/**
 * POST /api/subscribe  { email, interest? }
 *
 * Saves the visitor's address to the Resend audience. It sends no email. It works
 * with the store open or closed, since the coming-soon shop is what collects these.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // The form also sends `interest` ('tea', 'coffee' or 'both'). It is accepted and
  // not saved: Resend keeps a custom contact property only when one with that
  // name has been created in the account, and sending an unknown one could fail
  // the signup. To save it later, create an `interest` property in Resend and add
  // `properties: { interest }` to the create call below.
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

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    // resend v6 hands a failed call back as { error } and does not throw. An address
    // that is already in the audience counts as signed up: the visitor is on the
    // list either way, and answering the same for new and known addresses does not
    // tell anyone who has signed up.
    const { error } = await resend.contacts.create({
      email,
      audienceId: process.env.RESEND_AUDIENCE_ID,
      unsubscribed: false,
    });
    if (error && !isDuplicateContact(error)) {
      return fail(error);
    }
  } catch (err) {
    return fail(err);
  }

  return res.status(200).json({ ok: true });
}
