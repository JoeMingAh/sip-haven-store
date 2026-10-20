import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import SignupForm from './SignupForm.jsx';

// What the confirmation says depends on whether the shop is open, so each test
// sets the flag here. It starts closed, the state the original text was written for.
const store = vi.hoisted(() => ({ open: false }));
vi.mock('../../lib/store-config.js', async (importOriginal) => ({
  ...(await importOriginal()),
  isStoreOpen: () => store.open,
}));

// While the shop is closed: the first collection is still on its way.
const SUCCESS_TEXT =
  "You're on the list. We'll let you know the moment our first collection is ready.";
// Once the shop is open, "the moment our first collection is ready" would read stale.
const OPEN_SUCCESS_TEXT = "You're on the list. We'll keep you posted on new teas and coffees.";
const GENERIC_ERROR = 'Something went wrong. Please try again.';

// Every test gets its own fake fetch, so nothing here can reach the network.
let fetchMock;
beforeEach(() => {
  store.open = false;
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

// What /api/subscribe answers with: 200 { ok: true }, or 400 / 500 { error }.
const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const emailField = () => screen.getByLabelText('Email address');
const joinButton = () => screen.getByRole('button', { name: 'Join the list' });

function submit(email) {
  fireEvent.change(emailField(), { target: { value: email } });
  fireEvent.click(joinButton());
}

// The JSON the form posted on its first call.
const postedBody = () => JSON.parse(fetchMock.mock.calls[0][1].body);

describe('SignupForm: the form', () => {
  it('has a labelled email field and a submit button', () => {
    render(<SignupForm />);
    const field = emailField();
    expect(field).toHaveAttribute('type', 'email');
    expect(field).toHaveAttribute('autocomplete', 'email');
    expect(field).toBeRequired();
    expect(joinButton()).toHaveAttribute('type', 'submit');
  });

  it('has a polite, empty status region from the start', () => {
    render(<SignupForm />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toBeEmptyDOMElement();
  });

  it('does not mark the field invalid before anything goes wrong', () => {
    render(<SignupForm />);
    expect(emailField()).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('draws the field border in sage-deep: plain sage is only 3.1:1 on the sage-tint panels it sits on', () => {
    render(<SignupForm />);
    expect(emailField()).toHaveClass('border-2', 'border-sage-deep');
    expect(emailField()).not.toHaveClass('border-sage');
  });

  it('gives two forms on one page their own field ids', () => {
    render(
      <>
        <SignupForm />
        <SignupForm />
      </>,
    );
    const [first, second] = screen.getAllByLabelText('Email address');
    expect(first).not.toBe(second);
    expect(first.id).not.toBe(second.id);
  });

  it('sends the address typed into the form it belongs to', async () => {
    fetchMock.mockResolvedValue(reply(200, { ok: true }));
    render(
      <>
        <SignupForm />
        <SignupForm />
      </>,
    );
    const [, second] = screen.getAllByLabelText('Email address');
    fireEvent.change(second, { target: { value: 'second@example.com' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Join the list' })[1]);
    await screen.findByText(SUCCESS_TEXT);
    expect(postedBody()).toEqual({ email: 'second@example.com' });
  });
});

describe('SignupForm: what it posts', () => {
  it('posts the address as JSON to /api/subscribe', async () => {
    fetchMock.mockResolvedValue(reply(200, { ok: true }));
    render(<SignupForm />);
    submit('jane@example.com');
    await screen.findByText(SUCCESS_TEXT);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/subscribe');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual({ email: 'jane@example.com' });
  });

  it.each(['tea', 'coffee', 'both'])('includes interest %s when the form has one', async (interest) => {
    fetchMock.mockResolvedValue(reply(200, { ok: true }));
    render(<SignupForm interest={interest} />);
    submit('jane@example.com');
    await screen.findByText(SUCCESS_TEXT);
    expect(postedBody()).toEqual({ email: 'jane@example.com', interest });
  });

  it('leaves interest out when the form has none', async () => {
    fetchMock.mockResolvedValue(reply(200, { ok: true }));
    render(<SignupForm />);
    submit('jane@example.com');
    await screen.findByText(SUCCESS_TEXT);
    expect(postedBody()).not.toHaveProperty('interest');
  });
});

describe('SignupForm: success', () => {
  it('confirms in the status region and puts the form away', async () => {
    fetchMock.mockResolvedValue(reply(200, { ok: true }));
    render(<SignupForm />);
    // The live region has to exist before the message does, or a screen reader
    // may not announce it. So the same element must carry the message.
    const status = screen.getByRole('status');

    submit('jane@example.com');
    await screen.findByText(SUCCESS_TEXT);

    expect(screen.getByRole('status')).toBe(status);
    expect(within(status).getByText(SUCCESS_TEXT)).toBeInTheDocument();
    expect(screen.queryByLabelText('Email address')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('keeps the first-collection wording while the shop is closed', async () => {
    store.open = false;
    fetchMock.mockResolvedValue(reply(200, { ok: true }));
    render(<SignupForm />);
    submit('jane@example.com');
    await screen.findByText(SUCCESS_TEXT);
    expect(screen.queryByText(OPEN_SUCCESS_TEXT)).not.toBeInTheDocument();
  });

  it('says "new teas and coffees" once the shop is open', async () => {
    store.open = true;
    fetchMock.mockResolvedValue(reply(200, { ok: true }));
    render(<SignupForm />);
    const status = screen.getByRole('status');

    submit('jane@example.com');
    await screen.findByText(OPEN_SUCCESS_TEXT);

    expect(screen.getByRole('status')).toBe(status);
    expect(status).toHaveTextContent(OPEN_SUCCESS_TEXT);
    expect(screen.queryByText(SUCCESS_TEXT)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Email address')).not.toBeInTheDocument();
  });

  it('does not change what it posts when the shop is open', async () => {
    store.open = true;
    fetchMock.mockResolvedValue(reply(200, { ok: true }));
    render(<SignupForm interest="tea" />);
    submit('jane@example.com');
    await screen.findByText(OPEN_SUCCESS_TEXT);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/subscribe');
    expect(postedBody()).toEqual({ email: 'jane@example.com', interest: 'tea' });
  });

  it('shows the same error text whether the shop is open or not', async () => {
    store.open = true;
    fetchMock.mockResolvedValue(reply(400, { error: 'Please enter a valid email.' }));
    render(<SignupForm />);
    submit('not-an-email');
    expect(await screen.findByText('Please enter a valid email.')).toBeInTheDocument();
  });
});

describe('SignupForm: errors', () => {
  it("shows the API's error text inline", async () => {
    fetchMock.mockResolvedValue(reply(400, { error: 'Please enter a valid email.' }));
    render(<SignupForm />);
    const status = screen.getByRole('status');

    submit('not-an-email');
    await screen.findByText('Please enter a valid email.');

    expect(status).toHaveTextContent('Please enter a valid email.');
    expect(screen.queryByText(SUCCESS_TEXT)).not.toBeInTheDocument();
  });

  it("shows the server's own words, whatever they are", async () => {
    fetchMock.mockResolvedValue(reply(429, { error: 'Too many tries. Wait a minute.' }));
    render(<SignupForm />);
    submit('jane@example.com');
    expect(await screen.findByText('Too many tries. Wait a minute.')).toBeInTheDocument();
  });

  it('keeps the form and the typed address, and ties the error to the field', async () => {
    fetchMock.mockResolvedValue(reply(400, { error: 'Please enter a valid email.' }));
    render(<SignupForm />);
    submit('not-an-email');
    await screen.findByText('Please enter a valid email.');

    const field = emailField();
    expect(field).toHaveValue('not-an-email');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('Please enter a valid email.');
    expect(joinButton()).toBeEnabled();
  });

  // An error must not be told by its red alone: an alert icon leads the words, and the
  // field itself looks different (see the next test).
  it('puts an alert icon before the error text, hidden from assistive technology', async () => {
    fetchMock.mockResolvedValue(reply(400, { error: 'Please enter a valid email.' }));
    render(<SignupForm />);
    const status = screen.getByRole('status');

    submit('not-an-email');
    await screen.findByText('Please enter a valid email.');

    const icon = status.querySelector('svg.lucide-circle-alert');
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    // It leads the line, the way the tick leads the confirmation.
    expect(status.firstChild).toBe(icon);
    // The icon adds nothing to what is read out: the field's description is the words alone.
    expect(emailField()).toHaveAccessibleDescription('Please enter a valid email.');
  });

  it('puts the alert icon before the generic message too', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    render(<SignupForm />);
    submit('jane@example.com');
    await screen.findByText(GENERIC_ERROR);

    const status = screen.getByRole('status');
    const icon = status.querySelector('svg.lucide-circle-alert');
    expect(icon).not.toBeNull();
    expect(status.firstChild).toBe(icon);
  });

  it('draws the alert icon the size of the confirmation tick, in the same kind of row', async () => {
    fetchMock
      .mockResolvedValueOnce(reply(400, { error: 'Please enter a valid email.' }))
      .mockResolvedValueOnce(reply(200, { ok: true }));
    render(<SignupForm />);
    const status = screen.getByRole('status');

    submit('oops');
    await screen.findByText('Please enter a valid email.');
    const alertIcon = status.querySelector('svg');
    expect(alertIcon).toHaveClass('shrink-0');
    expect(status).toHaveClass('flex', 'items-start', 'gap-2');

    submit('jane@example.com');
    await screen.findByText(SUCCESS_TEXT);
    const tick = status.querySelector('svg');
    expect(tick).toHaveClass('shrink-0');
    expect(status).toHaveClass('flex', 'items-start', 'gap-2');
    expect(tick).toHaveAttribute('width', alertIcon.getAttribute('width'));
    expect(tick).toHaveAttribute('height', alertIcon.getAttribute('height'));
  });

  it('shows the alert icon only while an error is showing', async () => {
    fetchMock
      .mockResolvedValueOnce(reply(400, { error: 'Please enter a valid email.' }))
      .mockResolvedValueOnce(reply(200, { ok: true }));
    render(<SignupForm />);
    const status = screen.getByRole('status');
    const alertIcon = () => status.querySelector('svg.lucide-circle-alert');
    expect(alertIcon()).toBeNull();

    submit('oops');
    await screen.findByText('Please enter a valid email.');
    expect(alertIcon()).not.toBeNull();

    submit('jane@example.com');
    await screen.findByText(SUCCESS_TEXT);
    expect(alertIcon()).toBeNull();
    expect(status.querySelector('svg.lucide-check')).not.toBeNull();
  });

  it('takes the alert icon away with the message as soon as the next try starts', async () => {
    let finish;
    fetchMock
      .mockResolvedValueOnce(reply(400, { error: 'Please enter a valid email.' }))
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
    render(<SignupForm />);
    const status = screen.getByRole('status');

    submit('oops');
    await screen.findByText('Please enter a valid email.');
    expect(status.querySelector('svg.lucide-circle-alert')).not.toBeNull();

    submit('jane@example.com');
    expect(status).toBeEmptyDOMElement();

    finish(reply(200, { ok: true }));
    await screen.findByText(SUCCESS_TEXT);
  });

  it('gives an invalid field a look that does not rest on hue: a thicker, dashed red border', async () => {
    fetchMock.mockResolvedValue(reply(400, { error: 'Please enter a valid email.' }));
    render(<SignupForm />);
    submit('not-an-email');
    await screen.findByText('Please enter a valid email.');

    // The look is keyed to aria-invalid, so it is on exactly while the error is.
    const field = emailField();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveClass(
      'aria-[invalid=true]:border-4',
      'aria-[invalid=true]:border-dashed',
      'aria-[invalid=true]:border-red-800',
    );
  });

  it('lets the server judge the address: a bad one is still sent', async () => {
    fetchMock.mockResolvedValue(reply(400, { error: 'Please enter a valid email.' }));
    render(<SignupForm />);
    submit('not-an-email');
    await screen.findByText('Please enter a valid email.');
    expect(postedBody()).toEqual({ email: 'not-an-email' });
  });

  it.each([
    ['an empty body', reply(500, {})],
    ['a null body', reply(500, null)],
    ['a blank error', reply(500, { error: '   ' })],
    ['an error that is not text', reply(500, { error: { code: 1 } })],
    [
      'a body that is not JSON',
      {
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError('Unexpected token <');
        },
      },
    ],
    ['a response with no json method', { ok: false, status: 500 }],
  ])('falls back to the generic message for %s', async (_name, response) => {
    fetchMock.mockResolvedValue(response);
    render(<SignupForm />);
    submit('jane@example.com');
    expect(await screen.findByText(GENERIC_ERROR)).toBeInTheDocument();
  });

  it('shows the generic message when the request itself fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    render(<SignupForm />);
    submit('jane@example.com');

    expect(await screen.findByText(GENERIC_ERROR)).toBeInTheDocument();
    // The visitor can fix the address and try again.
    expect(emailField()).toHaveValue('jane@example.com');
    expect(joinButton()).toBeEnabled();
    expect(screen.queryByText(SUCCESS_TEXT)).not.toBeInTheDocument();
  });

  it('clears the error once a retry works', async () => {
    fetchMock
      .mockResolvedValueOnce(reply(400, { error: 'Please enter a valid email.' }))
      .mockResolvedValueOnce(reply(200, { ok: true }));
    render(<SignupForm />);

    submit('oops');
    await screen.findByText('Please enter a valid email.');
    submit('jane@example.com');
    await screen.findByText(SUCCESS_TEXT);

    expect(screen.queryByText('Please enter a valid email.')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('clears the old error as soon as the next try starts', async () => {
    let finish;
    fetchMock
      .mockResolvedValueOnce(reply(400, { error: 'Please enter a valid email.' }))
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
    render(<SignupForm />);

    submit('oops');
    await screen.findByText('Please enter a valid email.');
    submit('jane@example.com');

    expect(screen.queryByText('Please enter a valid email.')).not.toBeInTheDocument();
    expect(emailField()).not.toHaveAttribute('aria-invalid', 'true');

    finish(reply(200, { ok: true }));
    await screen.findByText(SUCCESS_TEXT);
  });
});

describe('SignupForm: while sending', () => {
  it('disables the button and says so, then enables it again after a failure', async () => {
    let finish;
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    render(<SignupForm />);
    submit('jane@example.com');

    const sending = screen.getByRole('button', { name: 'Sending...' });
    expect(sending).toBeDisabled();
    expect(emailField()).toHaveAttribute('readonly');

    finish(reply(500, { error: GENERIC_ERROR }));
    await screen.findByText(GENERIC_ERROR);

    expect(screen.getByRole('button', { name: 'Join the list' })).toBeEnabled();
    expect(emailField()).not.toHaveAttribute('readonly');
  });

  it('sends one request however many times the form is submitted', async () => {
    let finish;
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    render(<SignupForm />);
    submit('jane@example.com');

    // A second submit event (Enter in the field, say) skips the disabled button.
    const form = emailField().closest('form');
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    finish(reply(200, { ok: true }));
    await screen.findByText(SUCCESS_TEXT);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
