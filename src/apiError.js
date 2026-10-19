// What a shopper is told when one of our /api calls fails. The forms that call the
// API (email signup, checkout) share this, so they fail in the same words.

export const GENERIC_ERROR = 'Something went wrong. Please try again.';

/**
 * The error text an /api response sent back ({ error: '...' }), or GENERIC_ERROR
 * when it sent none that can be shown (an empty body, or a gateway error page that
 * is not JSON).
 */
export async function errorFrom(response) {
  try {
    const body = await response.json();
    if (typeof body?.error === 'string' && body.error.trim() !== '') return body.error;
  } catch {
    // Not JSON, so there is no text to show.
  }
  return GENERIC_ERROR;
}
