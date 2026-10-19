import { useId, useState } from 'react';
import { Check } from 'lucide-react';

const SUCCESS_MESSAGE =
  "You're on the list. We'll let you know the moment our first collection is ready.";
const GENERIC_ERROR = 'Something went wrong. Please try again.';

// The error text /api/subscribe sent back, or the generic message when it sent
// none that can be shown (an empty body, or a gateway error page that is not JSON).
async function errorFrom(response) {
  try {
    const body = await response.json();
    if (typeof body?.error === 'string' && body.error.trim() !== '') return body.error;
  } catch {
    // Not JSON, so there is no text to show.
  }
  return GENERIC_ERROR;
}

/**
 * Email signup. Posts { email, interest? } to /api/subscribe and shows what comes
 * back: the confirmation, or the API's own error text.
 *
 * The form turns off the browser's own checking (noValidate). The server decides
 * what a valid address is, so the visitor always sees its one message, styled like
 * the rest of the page, instead of a different bubble per browser.
 *
 * `interest` ('tea', 'coffee' or 'both') is sent along when the caller knows it.
 * The status line below is a live region that is always in the page, so a screen
 * reader announces the confirmation or the error when its text appears.
 */
export default function SignupForm({ interest }) {
  const fieldId = useId();
  const statusId = `${fieldId}-status`;
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'sending' | 'done'
  const [error, setError] = useState('');

  const isSending = status === 'sending';
  const isDone = status === 'done';
  const message = isDone ? SUCCESS_MESSAGE : error;

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
        body: JSON.stringify(interest ? { email, interest } : { email }),
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
              className="min-h-12 w-full min-w-0 rounded-full border-2 border-sage bg-cream px-5 text-base text-ink sm:flex-1"
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
            : `text-sm font-semibold text-red-800${error ? ' mt-3' : ''}`
        }
      >
        {isDone && <Check aria-hidden="true" size={20} className="mt-0.5 shrink-0" />}
        {message}
      </p>
    </div>
  );
}
