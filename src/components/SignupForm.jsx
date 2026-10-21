import { useId, useState } from 'react';
import { Check, CircleAlert } from 'lucide-react';
import { isStoreOpen } from '../../lib/store-config.js';
import { GENERIC_ERROR, errorFrom } from '../apiError.js';

// While the shop is closed the list is how people hear about the first collection.
const SUCCESS_MESSAGE =
  "You're on the list. We'll let you know the moment our first collection is ready.";
// Once the shop is open that wording would read stale.
const OPEN_SUCCESS_MESSAGE = "You're on the list. We'll keep you posted on new teas and coffees.";

/**
 * Email signup. Posts { email, interest?, answers?, topMatch?, matches?, source } to
 * /api/subscribe and shows what comes back: the confirmation, or the API's own error
 * text. The confirmation depends on whether the shop is open (see the two messages
 * above).
 *
 * The form turns off the browser's own checking (noValidate). The server decides
 * what a valid address is, so the visitor always sees its one message, styled like
 * the rest of the page, instead of a different bubble per browser.
 *
 * `interest` ('tea', 'coffee' or 'both') is sent along when the caller knows it. The
 * quiz also passes its `answers` ({ drink, caffeine, flavor, aroma, style }), the slugs
 * of its picks, best first, as `matches` and the first of them as `topMatch` (when it
 * has any), and `source` 'quiz'. Every other form is
 * `source` 'site', the default. The server checks all of these and drops what it does
 * not know, so none of them can make a signup fail.
 *
 * The status line below is a live region that is always in the page, so a screen
 * reader announces the confirmation or the error when its text appears.
 *
 * An error is not told by its red alone. An alert icon leads the words, as a tick leads
 * the confirmation, and while the field is aria-invalid its border turns thick, dashed
 * and red-800, a difference of line as well as of hue.
 */
export default function SignupForm({ interest, answers, topMatch, matches, source = 'site' }) {
  const fieldId = useId();
  const statusId = `${fieldId}-status`;
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'sending' | 'done'
  const [error, setError] = useState('');

  const isSending = status === 'sending';
  const isDone = status === 'done';
  const hasError = !isDone && error !== '';
  const message = isDone ? (isStoreOpen() ? OPEN_SUCCESS_MESSAGE : SUCCESS_MESSAGE) : error;

  async function handleSubmit(event) {
    event.preventDefault();
    // A second submit while one is in flight (Enter in the field) must not send again.
    if (isSending) return;

    setStatus('sending');
    setError('');
    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          ...(interest && { interest }),
          ...(answers && { answers }),
          ...(topMatch && { topMatch }),
          ...(matches?.length > 0 && { matches }),
          source,
        }),
      });
      if (response.ok) {
        setStatus('done');
        return;
      }
      setError(await errorFrom(response));
    } catch {
      // fetch itself failed: offline, or the request never reached the server.
      setError(GENERIC_ERROR);
    }
    setStatus('idle');
  }

  return (
    <div>
      {!isDone && (
        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor={fieldId} className="block text-sm font-semibold text-ink">
            Email address
          </label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <input
              id={fieldId}
              name="email"
              type="email"
              autoComplete="email"
              required
              readOnly={isSending}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={error ? statusId : undefined}
              className="min-h-12 w-full min-w-0 rounded-full border-2 border-sage-deep bg-cream px-5 text-base text-ink aria-[invalid=true]:border-4 aria-[invalid=true]:border-dashed aria-[invalid=true]:border-red-800 sm:flex-1"
            />
            <button
              type="submit"
              disabled={isSending}
              className="min-h-12 rounded-full bg-sage-deep px-7 text-base font-semibold text-cream hover:bg-ink disabled:cursor-wait disabled:opacity-70 sm:shrink-0"
            >
              {isSending ? 'Sending...' : 'Join the list'}
            </button>
          </div>
        </form>
      )}

      <p
        id={statusId}
        role="status"
        aria-live="polite"
        className={
          isDone
            ? 'flex items-start gap-2 text-base font-semibold text-sage-deep'
            : `text-sm font-semibold text-red-800${hasError ? ' mt-3 flex items-start gap-2' : ''}`
        }
      >
        {isDone && <Check aria-hidden="true" size={20} className="mt-0.5 shrink-0" />}
        {hasError && <CircleAlert aria-hidden="true" size={20} className="shrink-0" />}
        {message}
      </p>
    </div>
  );
}
