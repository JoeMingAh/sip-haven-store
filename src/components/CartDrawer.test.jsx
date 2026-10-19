import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { MAX_QTY } from '../../lib/store-config.js';
import { CartProvider, useCart, STALE_NOTICE } from '../cart/CartContext.jsx';
import { CHECKOUT_TIMEOUT_MS } from '../cart/checkout.js';
import { placeholderFor } from '../assets/placeholders/index.js';
import { JASMINE, DAWN } from '../test/fixtures.js';
import CartDrawer from './CartDrawer.jsx';

// The drawer reads the store flag and looks variants up in the lineup, so each test
// sets both here.
const shop = vi.hoisted(() => ({ open: true, products: [] }));
vi.mock('../../lib/store-config.js', async (importOriginal) => ({
  ...(await importOriginal()),
  isStoreOpen: () => shop.open,
}));
vi.mock('../../lib/catalog.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    findVariant: (slug, id) => actual.findVariant(slug, id, shop),
  };
});

const KEY = 'siphaven-cart-v2';
const GENERIC_ERROR = 'Something went wrong. Please try again.';
const STRIPE_URL = 'https://checkout.stripe.com/c/pay/cs_test_abc123';

let fetchMock;
let assign;
beforeEach(() => {
  shop.open = true;
  shop.products = [JASMINE, DAWN];
  window.localStorage.clear();
  fetchMock = vi.fn();
  assign = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  // jsdom cannot navigate. Swap in a location whose assign we can watch.
  vi.stubGlobal('location', { ...window.location, assign });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// What /api/checkout answers with: 200 { url }, or 400 / 403 / 500 { error }.
const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const line = (slug, variantId, qty = 1) => ({ slug, variantId, qty });
const LOOSE = line('jasmine-dream', 'loose-leaf-2oz', 2); // 2 x $18.00
const GROUND = line('dawn-roast', 'ground-12oz', 1); // 1 x $16.50

const seed = (lines) => window.localStorage.setItem(KEY, JSON.stringify(lines));
const saved = () => JSON.parse(window.localStorage.getItem(KEY));

function OpenCart() {
  const { open } = useCart();
  return (
    <button type="button" onClick={() => open()}>
      Open cart
    </button>
  );
}

function GoElsewhere() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate('/elsewhere')}>
      Go elsewhere
    </button>
  );
}

function renderDrawer({ lines, path = '/' } = {}) {
  if (lines) seed(lines);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CartProvider>
        <OpenCart />
        <GoElsewhere />
        <CartDrawer />
      </CartProvider>
    </MemoryRouter>,
  );
}

// Open the way a shopper does: the button has focus, then it is activated.
function openDrawer() {
  const opener = screen.getByRole('button', { name: 'Open cart' });
  opener.focus();
  fireEvent.click(opener);
  return opener;
}

const dialog = () => screen.getByRole('dialog', { name: 'Your cart' });
const inDialog = () => within(dialog());
const checkoutButton = () => inDialog().getByRole('button', { name: 'Checkout' });
const closeButton = () => inDialog().getByRole('button', { name: 'Close cart' });
const JASMINE_LABEL = 'Jasmine Dream (Loose leaf, 2 oz)';
const DAWN_LABEL = 'Dawn Roast (Ground, 12 oz)';
const more = (label) => inDialog().getByRole('button', { name: `Increase quantity of ${label}` });
const fewer = (label) => inDialog().getByRole('button', { name: `Decrease quantity of ${label}` });
const remove = (label) => inDialog().getByRole('button', { name: `Remove ${label} from cart` });
const qtyOf = (label) => within(inDialog().getByRole('group', { name: `Quantity of ${label}` }));

describe('CartDrawer: opening', () => {
  it('draws nothing until the cart is opened, whatever is in it', () => {
    renderDrawer({ lines: [LOOSE] });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Checkout')).not.toBeInTheDocument();
  });

  it('opens as a modal dialog named "Your cart"', () => {
    renderDrawer();
    openDrawer();
    expect(dialog()).toHaveAttribute('aria-modal', 'true');
    expect(inDialog().getByRole('heading', { level: 2, name: 'Your cart' })).toBeInTheDocument();
  });

  it('has a visible Close button', () => {
    renderDrawer();
    openDrawer();
    expect(closeButton()).toBeVisible();
    expect(closeButton()).toHaveAttribute('type', 'button');
  });
});

describe('CartDrawer: an empty cart', () => {
  it('says so and points to Tea and Coffee', () => {
    renderDrawer();
    openDrawer();
    expect(inDialog().getByText('Your cart is empty.')).toBeInTheDocument();
    expect(inDialog().getByRole('link', { name: 'Browse tea' })).toHaveAttribute('href', '/tea');
    expect(inDialog().getByRole('link', { name: 'Browse coffee' })).toHaveAttribute('href', '/coffee');
  });

  it('has nothing to check out, no subtotal and no shipping bar', () => {
    renderDrawer();
    openDrawer();
    expect(inDialog().queryByRole('button', { name: 'Checkout' })).not.toBeInTheDocument();
    expect(inDialog().queryByText('Subtotal')).not.toBeInTheDocument();
    expect(inDialog().queryByRole('progressbar')).not.toBeInTheDocument();
    expect(dialog()).not.toHaveTextContent('$');
  });
});

describe('CartDrawer: the lines', () => {
  it('shows each line with its name, format, size, price and quantity', () => {
    renderDrawer({ lines: [LOOSE, GROUND] });
    openDrawer();

    const items = within(inDialog().getByRole('list', { name: 'Items in your cart' })).getAllByRole('listitem');
    expect(items).toHaveLength(2);

    const [jasmine, dawn] = items;
    expect(within(jasmine).getByRole('link', { name: 'Jasmine Dream' })).toHaveAttribute(
      'href',
      '/products/jasmine-dream',
    );
    expect(jasmine).toHaveTextContent('Loose leaf, 2 oz');
    expect(jasmine).toHaveTextContent('$18.00 each');
    expect(jasmine).toHaveTextContent('$36.00');
    expect(qtyOf(JASMINE_LABEL).getByText('2')).toBeInTheDocument();

    expect(within(dawn).getByRole('link', { name: 'Dawn Roast' })).toHaveAttribute(
      'href',
      '/products/dawn-roast',
    );
    expect(dawn).toHaveTextContent('Ground, 12 oz');
    expect(dawn).toHaveTextContent('$16.50 each');
    expect(qtyOf(DAWN_LABEL).getByText('1')).toBeInTheDocument();
  });

  it('keeps the chosen grind: whole bean and ground are two lines', () => {
    renderDrawer({ lines: [line('dawn-roast', 'whole-bean-12oz'), line('dawn-roast', 'ground-12oz')] });
    openDrawer();
    const items = inDialog().getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Whole bean, 12 oz');
    expect(items[1]).toHaveTextContent('Ground, 12 oz');
  });

  it('gives each line its own key, so two variants of one product do not confuse React', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderDrawer({ lines: [line('dawn-roast', 'whole-bean-12oz'), line('dawn-roast', 'ground-12oz')] });
    openDrawer();
    const complaints = error.mock.calls.map((call) => call.join(' ')).filter((text) => /same key/i.test(text));
    error.mockRestore();
    expect(complaints).toEqual([]);
  });

  it('shows placeholder art for a product with no photo, and the photo for one that has it', () => {
    shop.products = [JASMINE, { ...DAWN, images: ['/photos/dawn.jpg'] }];
    renderDrawer({ lines: [LOOSE, GROUND] });
    openDrawer();
    const [jasmine, dawn] = inDialog().getAllByRole('listitem');
    expect(jasmine.querySelector('img')).toHaveAttribute('src', placeholderFor(JASMINE));
    expect(jasmine.querySelector('img')).toHaveAttribute('alt', '');
    expect(dawn.querySelector('img')).toHaveAttribute('src', '/photos/dawn.jpg');
  });
});

describe('CartDrawer: the totals', () => {
  it('shows the subtotal and says taxes come at checkout', () => {
    renderDrawer({ lines: [line('jasmine-dream', 'tea-bags-15', 1)] });
    openDrawer();
    expect(inDialog().getByText('Subtotal').parentElement).toHaveTextContent('Subtotal $14.00');
    expect(inDialog().getByText('Taxes calculated at checkout')).toBeInTheDocument();
  });

  it('adds up every line', () => {
    renderDrawer({ lines: [LOOSE, GROUND] }); // $36.00 + $16.50
    openDrawer();
    expect(inDialog().getByText('Subtotal').parentElement).toHaveTextContent('Subtotal $52.50');
  });

  it('says how far the cart is from free shipping', () => {
    renderDrawer({ lines: [line('jasmine-dream', 'tea-bags-15', 1)] }); // $14.00
    openDrawer();
    expect(inDialog().getByText('$36.00 away from free shipping')).toBeInTheDocument();
  });

  it('says the shipping is earned once the subtotal reaches the threshold', () => {
    renderDrawer({ lines: [LOOSE, GROUND] }); // $52.50
    openDrawer();
    expect(inDialog().getByText("You've earned free shipping")).toBeInTheDocument();
  });
});

describe('CartDrawer: changing quantities', () => {
  it('+ adds one and updates the line, the subtotal and the saved cart', () => {
    renderDrawer({ lines: [LOOSE] });
    openDrawer();
    fireEvent.click(more(JASMINE_LABEL));

    expect(qtyOf(JASMINE_LABEL).getByText('3')).toBeInTheDocument();
    expect(inDialog().getByText('Subtotal').parentElement).toHaveTextContent('Subtotal $54.00');
    expect(saved()).toEqual([line('jasmine-dream', 'loose-leaf-2oz', 3)]);
  });

  it('- takes one off', () => {
    renderDrawer({ lines: [LOOSE] });
    openDrawer();
    fireEvent.click(fewer(JASMINE_LABEL));
    expect(qtyOf(JASMINE_LABEL).getByText('1')).toBeInTheDocument();
    expect(saved()).toEqual([line('jasmine-dream', 'loose-leaf-2oz', 1)]);
  });

  it('- takes exactly one off a bigger quantity, and + puts exactly one back', () => {
    renderDrawer({ lines: [line('jasmine-dream', 'loose-leaf-2oz', 5)] });
    openDrawer();
    fireEvent.click(fewer(JASMINE_LABEL));
    expect(qtyOf(JASMINE_LABEL).getByText('4')).toBeInTheDocument();
    fireEvent.click(more(JASMINE_LABEL));
    expect(qtyOf(JASMINE_LABEL).getByText('5')).toBeInTheDocument();
    expect(saved()).toEqual([line('jasmine-dream', 'loose-leaf-2oz', 5)]);
  });

  it('cannot go below 1: - is off at 1', () => {
    renderDrawer({ lines: [line('jasmine-dream', 'loose-leaf-2oz', 1)] });
    openDrawer();
    expect(fewer(JASMINE_LABEL)).toBeDisabled();
    fireEvent.click(fewer(JASMINE_LABEL));
    expect(qtyOf(JASMINE_LABEL).getByText('1')).toBeInTheDocument();
    expect(more(JASMINE_LABEL)).toBeEnabled();
  });

  it(`cannot go above ${MAX_QTY}: + is off at ${MAX_QTY}`, () => {
    renderDrawer({ lines: [line('jasmine-dream', 'loose-leaf-2oz', MAX_QTY - 1)] });
    openDrawer();
    expect(more(JASMINE_LABEL)).toBeEnabled();
    fireEvent.click(more(JASMINE_LABEL));

    expect(qtyOf(JASMINE_LABEL).getByText(String(MAX_QTY))).toBeInTheDocument();
    expect(more(JASMINE_LABEL)).toBeDisabled();
    expect(fewer(JASMINE_LABEL)).toBeEnabled();
    fireEvent.click(more(JASMINE_LABEL));
    expect(saved()).toEqual([line('jasmine-dream', 'loose-leaf-2oz', MAX_QTY)]);
  });

  it('changes only the line whose button was pressed', () => {
    renderDrawer({ lines: [LOOSE, GROUND] });
    openDrawer();
    fireEvent.click(more(DAWN_LABEL));
    expect(saved()).toEqual([LOOSE, line('dawn-roast', 'ground-12oz', 2)]);
  });
});

describe('CartDrawer: removing', () => {
  it('Remove deletes just that line', () => {
    renderDrawer({ lines: [LOOSE, GROUND] });
    openDrawer();
    fireEvent.click(remove(JASMINE_LABEL));

    expect(inDialog().queryByRole('link', { name: 'Jasmine Dream' })).not.toBeInTheDocument();
    expect(inDialog().getByRole('link', { name: 'Dawn Roast' })).toBeInTheDocument();
    expect(saved()).toEqual([GROUND]);
  });

  it('shows the empty cart after the last line goes, with no Checkout', () => {
    renderDrawer({ lines: [LOOSE] });
    openDrawer();
    fireEvent.click(remove(JASMINE_LABEL));
    expect(inDialog().getByText('Your cart is empty.')).toBeInTheDocument();
    expect(inDialog().queryByRole('button', { name: 'Checkout' })).not.toBeInTheDocument();
  });

  it('keeps focus in the dialog when the button that had it is removed', () => {
    renderDrawer({ lines: [LOOSE] });
    openDrawer();
    remove(JASMINE_LABEL).focus();
    fireEvent.click(remove(JASMINE_LABEL));
    expect(dialog()).toHaveFocus();
  });
});

describe('CartDrawer: the notice about lines that were dropped', () => {
  it('shows the notice when the saved cart held something that is no longer sold', () => {
    renderDrawer({ lines: [line('retired-tea', 'loose-leaf-2oz'), GROUND] });
    openDrawer();
    expect(inDialog().getByText(STALE_NOTICE)).toBeInTheDocument();
    // The good line stays.
    expect(inDialog().getByRole('link', { name: 'Dawn Roast' })).toBeInTheDocument();
  });

  it('does not show it when nothing was dropped', () => {
    renderDrawer({ lines: [GROUND] });
    openDrawer();
    expect(inDialog().queryByText(STALE_NOTICE)).not.toBeInTheDocument();
  });

  it('shows it above an empty cart too', () => {
    renderDrawer({ lines: [line('retired-tea', 'loose-leaf-2oz')] });
    openDrawer();
    expect(inDialog().getByText(STALE_NOTICE)).toBeInTheDocument();
    expect(inDialog().getByText('Your cart is empty.')).toBeInTheDocument();
  });

  it('is shown once: it is gone the next time the cart is opened', () => {
    renderDrawer({ lines: [line('retired-tea', 'loose-leaf-2oz'), GROUND] });
    openDrawer();
    fireEvent.click(closeButton());
    openDrawer();
    expect(inDialog().queryByText(STALE_NOTICE)).not.toBeInTheDocument();
  });
});

describe('CartDrawer: checkout', () => {
  it('posts the cart to /api/checkout as { items: [{ slug, variantId, qty }] }', async () => {
    fetchMock.mockResolvedValue(reply(200, { url: STRIPE_URL }));
    renderDrawer({ lines: [LOOSE, GROUND] });
    openDrawer();
    fireEvent.click(checkoutButton());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/checkout');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual({
      items: [
        { slug: 'jasmine-dream', variantId: 'loose-leaf-2oz', qty: 2 },
        { slug: 'dawn-roast', variantId: 'ground-12oz', qty: 1 },
      ],
    });
    await vi.waitFor(() => expect(assign).toHaveBeenCalled());
  });

  it('sends the quantity and variant as changed in the drawer', async () => {
    fetchMock.mockResolvedValue(reply(200, { url: STRIPE_URL }));
    renderDrawer({ lines: [line('dawn-roast', 'ground-12oz', 1)] });
    openDrawer();
    fireEvent.click(more(DAWN_LABEL));
    fireEvent.click(more(DAWN_LABEL));
    fireEvent.click(checkoutButton());

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      items: [{ slug: 'dawn-roast', variantId: 'ground-12oz', qty: 3 }],
    });
    await vi.waitFor(() => expect(assign).toHaveBeenCalled());
  });

  it('sends the shopper to the url it gets back', async () => {
    fetchMock.mockResolvedValue(reply(200, { url: STRIPE_URL }));
    renderDrawer({ lines: [LOOSE] });
    openDrawer();
    fireEvent.click(checkoutButton());

    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith(STRIPE_URL));
    expect(assign).toHaveBeenCalledTimes(1);
  });

  it('turns Checkout off while the request is in flight, and says it is busy', async () => {
    let finish;
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderDrawer({ lines: [LOOSE] });
    openDrawer();
    fireEvent.click(checkoutButton());

    expect(checkoutButton()).toBeDisabled();
    expect(checkoutButton()).toHaveAttribute('aria-busy', 'true');

    await act(async () => finish(reply(400, { error: 'That item is no longer available.' })));
    expect(await inDialog().findByText('That item is no longer available.')).toBeInTheDocument();
    expect(checkoutButton()).toBeEnabled();
    expect(checkoutButton()).not.toHaveAttribute('aria-busy', 'true');
  });

  it('sends one request however many times Checkout is clicked', async () => {
    let finish;
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderDrawer({ lines: [LOOSE] });
    openDrawer();
    const button = checkoutButton();
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => finish(reply(200, { url: STRIPE_URL })));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends one request even when two clicks land before the button has been turned off', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    renderDrawer({ lines: [LOOSE] });
    openDrawer();
    const button = checkoutButton();

    // Both clicks arrive in one batch, so React has not redrawn the button as disabled
    // by the second. The disabled attribute cannot be what stops it; a guard in the
    // handler has to.
    act(() => {
      button.click();
      button.click();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('stays off after a good answer, while the browser leaves for Stripe', async () => {
    fetchMock.mockResolvedValue(reply(200, { url: STRIPE_URL }));
    renderDrawer({ lines: [LOOSE] });
    openDrawer();
    fireEvent.click(checkoutButton());
    await vi.waitFor(() => expect(assign).toHaveBeenCalled());

    expect(checkoutButton()).toBeDisabled();
    fireEvent.click(checkoutButton());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('turns Checkout back on if the page comes back from the browser cache after Stripe', async () => {
    fetchMock.mockResolvedValue(reply(200, { url: STRIPE_URL }));
    renderDrawer({ lines: [LOOSE] });
    openDrawer();
    fireEvent.click(checkoutButton());
    await vi.waitFor(() => expect(assign).toHaveBeenCalled());
    expect(checkoutButton()).toBeDisabled();

    act(() => {
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    });
    expect(checkoutButton()).toBeEnabled();
  });

  it('leaves Checkout alone for an ordinary page show', async () => {
    fetchMock.mockResolvedValue(reply(200, { url: STRIPE_URL }));
    renderDrawer({ lines: [LOOSE] });
    openDrawer();
    fireEvent.click(checkoutButton());
    await vi.waitFor(() => expect(assign).toHaveBeenCalled());

    act(() => {
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }));
    });
    expect(checkoutButton()).toBeDisabled();
  });
});

describe('CartDrawer: when checkout fails', () => {
  it('shows "That item is no longer available." inline', async () => {
    fetchMock.mockResolvedValue(reply(400, { error: 'That item is no longer available.' }));
    renderDrawer({ lines: [LOOSE] });
    openDrawer();
    fireEvent.click(checkoutButton());

    const message = await inDialog().findByText('That item is no longer available.');
    expect(message).toHaveAttribute('role', 'alert');
    expect(assign).not.toHaveBeenCalled();
    // The cart is untouched and the shopper can try again.
    expect(saved()).toEqual([LOOSE]);
    expect(checkoutButton()).toBeEnabled();
  });

  it.each([
    [400, 'Quantity must be between 1 and 20.'],
    [403, 'Store is not open yet.'],
    [500, 'Payment session could not be created.'],
  ])("shows the server's own words for a %i", async (status, error) => {
    fetchMock.mockResolvedValue(reply(status, { error }));
    renderDrawer({ lines: [LOOSE] });
    openDrawer();
    fireEvent.click(checkoutButton());
    expect(await inDialog().findByText(error)).toBeInTheDocument();
  });

  it('says "Something went wrong. Please try again." when the request itself fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    renderDrawer({ lines: [LOOSE] });
    openDrawer();
    fireEvent.click(checkoutButton());

    expect(await inDialog().findByText(GENERIC_ERROR)).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
    expect(checkoutButton()).toBeEnabled();
  });

  it('says it too when the answer has no error text to show', async () => {
    fetchMock.mockResolvedValue(reply(500, {}));
    renderDrawer({ lines: [LOOSE] });
    openDrawer();
    fireEvent.click(checkoutButton());
    expect(await inDialog().findByText(GENERIC_ERROR)).toBeInTheDocument();
  });

  it('never leaves for an address that is not a web page', async () => {
    fetchMock.mockResolvedValue(reply(200, { url: 'javascript:alert(1)' }));
    renderDrawer({ lines: [LOOSE] });
    openDrawer();
    fireEvent.click(checkoutButton());

    expect(await inDialog().findByText(GENERIC_ERROR)).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });

  it('clears the old message as soon as the next try starts, and again on a good answer', async () => {
    let finish;
    fetchMock
      .mockResolvedValueOnce(reply(400, { error: 'That item is no longer available.' }))
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
    renderDrawer({ lines: [LOOSE] });
    openDrawer();
    fireEvent.click(checkoutButton());
    await inDialog().findByText('That item is no longer available.');

    fireEvent.click(checkoutButton());
    expect(inDialog().queryByText('That item is no longer available.')).not.toBeInTheDocument();

    await act(async () => finish(reply(200, { url: STRIPE_URL })));
    expect(assign).toHaveBeenCalledWith(STRIPE_URL);
  });

  it('drops the message once the cart changes, since it was about the old cart', async () => {
    fetchMock.mockResolvedValue(reply(400, { error: 'That item is no longer available.' }));
    renderDrawer({ lines: [LOOSE, GROUND] });
    openDrawer();
    fireEvent.click(checkoutButton());
    await inDialog().findByText('That item is no longer available.');

    fireEvent.click(remove(DAWN_LABEL));
    expect(inDialog().queryByText('That item is no longer available.')).not.toBeInTheDocument();
  });
});

// A fetch that is answered by hand: `finish(response)` is the answer arriving.
function answerByHand() {
  const hand = {};
  fetchMock.mockReturnValue(
    new Promise((resolve) => {
      hand.finish = resolve;
    }),
  );
  return hand;
}

// The signal the drawer gave its checkout request.
const requestSignal = () => fetchMock.mock.calls[0][1].signal;

describe('CartDrawer: a checkout request that takes too long', () => {
  it('gives up after 20 seconds, says something went wrong, and lets the shopper try again', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    // A fetch that never answers, and fails as a real one does when it is aborted.
    fetchMock.mockImplementation(
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () =>
            reject(new DOMException('The operation was aborted.', 'AbortError')),
          );
        }),
    );
    renderDrawer({ lines: [LOOSE] });
    openDrawer();
    fireEvent.click(checkoutButton());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CHECKOUT_TIMEOUT_MS - 1);
    });
    expect(checkoutButton()).toBeDisabled();
    expect(inDialog().queryByRole('alert')).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(inDialog().getByRole('alert')).toHaveTextContent(GENERIC_ERROR);
    expect(checkoutButton()).toBeEnabled();
    expect(checkoutButton()).not.toHaveAttribute('aria-busy', 'true');
    expect(assign).not.toHaveBeenCalled();
    expect(saved()).toEqual([LOOSE]);
  });
});

describe('CartDrawer: closed while the checkout request is out', () => {
  it.each([
    ['the Close button', () => fireEvent.click(closeButton())],
    ['Escape', () => fireEvent.keyDown(document.activeElement, { key: 'Escape' })],
    ['a click on the dimmed page', () => fireEvent.click(dialog().previousElementSibling)],
    ['going to another page', () => fireEvent.click(screen.getByRole('button', { name: 'Go elsewhere' }))],
  ])('stops the request, and sends nobody to Stripe, when the cart is closed by %s', async (_how, closeIt) => {
    const hand = answerByHand();
    renderDrawer({ lines: [LOOSE] });
    openDrawer();
    fireEvent.click(checkoutButton());
    expect(requestSignal().aborted).toBe(false);

    closeIt();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(requestSignal().aborted).toBe(true);

    // An answer that gets through anyway goes nowhere.
    await act(async () => hand.finish(reply(200, { url: STRIPE_URL })));
    expect(assign).not.toHaveBeenCalled();
  });

  it('stops the request, and sends nobody to Stripe, when the page is taken away', async () => {
    const hand = answerByHand();
    const { unmount } = renderDrawer({ lines: [LOOSE] });
    openDrawer();
    fireEvent.click(checkoutButton());

    unmount();
    expect(requestSignal().aborted).toBe(true);

    await act(async () => hand.finish(reply(200, { url: STRIPE_URL })));
    expect(assign).not.toHaveBeenCalled();
  });

  it('shows nothing from the old request when the cart is opened again', async () => {
    const hand = answerByHand();
    renderDrawer({ lines: [LOOSE] });
    openDrawer();
    fireEvent.click(checkoutButton());
    fireEvent.click(closeButton());
    openDrawer();

    await act(async () => hand.finish(reply(400, { error: 'That item is no longer available.' })));

    expect(inDialog().queryByText('That item is no longer available.')).not.toBeInTheDocument();
    expect(inDialog().queryByRole('alert')).not.toBeInTheDocument();
    expect(checkoutButton()).toBeEnabled();
    expect(checkoutButton()).not.toHaveAttribute('aria-busy', 'true');
    expect(assign).not.toHaveBeenCalled();
  });

  it('can check out from the cart it was opened again to', async () => {
    const hand = answerByHand();
    renderDrawer({ lines: [LOOSE] });
    openDrawer();
    fireEvent.click(checkoutButton());
    fireEvent.click(closeButton());
    await act(async () => hand.finish(reply(200, { url: STRIPE_URL })));

    fetchMock.mockResolvedValue(reply(200, { url: STRIPE_URL }));
    openDrawer();
    fireEvent.click(checkoutButton());

    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith(STRIPE_URL));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(assign).toHaveBeenCalledTimes(1);
  });

});

describe('CartDrawer: while the checkout request is out', () => {
  const lines = [LOOSE, GROUND]; // two of the first, one of the second

  function startCheckoutOf(cart = lines) {
    const hand = answerByHand();
    renderDrawer({ lines: cart });
    openDrawer();
    fireEvent.click(checkoutButton());
    return hand;
  }

  it('turns off every quantity stepper and every Remove button', () => {
    answerByHand();
    renderDrawer({ lines });
    openDrawer();
    // The first line is at 2, so both of its steppers are on until Checkout is pressed.
    for (const label of [JASMINE_LABEL, DAWN_LABEL]) {
      expect(more(label)).toBeEnabled();
      expect(remove(label)).toBeEnabled();
    }
    expect(fewer(JASMINE_LABEL)).toBeEnabled();

    fireEvent.click(checkoutButton());

    for (const label of [JASMINE_LABEL, DAWN_LABEL]) {
      expect(more(label)).toBeDisabled();
      expect(fewer(label)).toBeDisabled();
      expect(remove(label)).toBeDisabled();
    }
  });

  it('changes nothing when they are pressed anyway', () => {
    startCheckoutOf();
    fireEvent.click(more(JASMINE_LABEL));
    fireEvent.click(fewer(JASMINE_LABEL));
    fireEvent.click(remove(DAWN_LABEL));
    expect(saved()).toEqual([LOOSE, GROUND]);
    expect(qtyOf(JASMINE_LABEL).getByText('2')).toBeInTheDocument();
    expect(inDialog().getByRole('link', { name: 'Dawn Roast' })).toBeInTheDocument();
  });

  it('turns them on again after a failure, keeping the limits of 1 and the most allowed', async () => {
    const atMost = line('dawn-roast', 'ground-12oz', MAX_QTY);
    const atLeast = line('jasmine-dream', 'loose-leaf-2oz', 1);
    const hand = startCheckoutOf([atLeast, atMost]);

    await act(async () => hand.finish(reply(400, { error: 'That item is no longer available.' })));

    expect(remove(JASMINE_LABEL)).toBeEnabled();
    expect(remove(DAWN_LABEL)).toBeEnabled();
    expect(more(JASMINE_LABEL)).toBeEnabled();
    expect(fewer(DAWN_LABEL)).toBeEnabled();
    // The limits still hold.
    expect(fewer(JASMINE_LABEL)).toBeDisabled();
    expect(more(DAWN_LABEL)).toBeDisabled();
  });

  it('turns them on again when the request times out', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    fetchMock.mockImplementation(
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () =>
            reject(new DOMException('The operation was aborted.', 'AbortError')),
          );
        }),
    );
    renderDrawer({ lines });
    openDrawer();
    fireEvent.click(checkoutButton());
    expect(remove(JASMINE_LABEL)).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CHECKOUT_TIMEOUT_MS);
    });
    expect(remove(JASMINE_LABEL)).toBeEnabled();
    expect(more(JASMINE_LABEL)).toBeEnabled();
  });

  it('keeps them off once Stripe has the shopper, while the browser leaves', async () => {
    fetchMock.mockResolvedValue(reply(200, { url: STRIPE_URL }));
    renderDrawer({ lines });
    openDrawer();
    fireEvent.click(checkoutButton());
    await vi.waitFor(() => expect(assign).toHaveBeenCalled());

    expect(remove(JASMINE_LABEL)).toBeDisabled();
    expect(more(JASMINE_LABEL)).toBeDisabled();
    expect(fewer(JASMINE_LABEL)).toBeDisabled();
  });

  it('turns them on again with Checkout when the page comes back from the browser cache', async () => {
    fetchMock.mockResolvedValue(reply(200, { url: STRIPE_URL }));
    renderDrawer({ lines });
    openDrawer();
    fireEvent.click(checkoutButton());
    await vi.waitFor(() => expect(assign).toHaveBeenCalled());

    act(() => {
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    });
    expect(checkoutButton()).toBeEnabled();
    expect(remove(JASMINE_LABEL)).toBeEnabled();
    expect(more(JASMINE_LABEL)).toBeEnabled();
  });
});

describe('CartDrawer: closing', () => {
  it('closes with the Close button', () => {
    renderDrawer({ lines: [LOOSE] });
    openDrawer();
    fireEvent.click(closeButton());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on Escape', () => {
    renderDrawer({ lines: [LOOSE] });
    openDrawer();
    fireEvent.keyDown(document.activeElement, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on Escape even when focus has slipped out to the page', () => {
    renderDrawer({ lines: [LOOSE] });
    openDrawer();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('ignores other keys', () => {
    renderDrawer({ lines: [LOOSE] });
    openDrawer();
    fireEvent.keyDown(document.activeElement, { key: 'a' });
    fireEvent.keyDown(document.activeElement, { key: 'Enter' });
    expect(dialog()).toBeInTheDocument();
  });

  it('closes when the dimmed page behind it is clicked, but not when the dialog is', () => {
    renderDrawer({ lines: [LOOSE] });
    openDrawer();

    fireEvent.click(dialog());
    fireEvent.click(inDialog().getByText('Your cart'));
    expect(dialog()).toBeInTheDocument();

    // The backdrop is the element just behind the dialog.
    fireEvent.click(dialog().previousElementSibling);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes when the shopper goes to another page, such as with the Back button', () => {
    renderDrawer({ lines: [LOOSE] });
    openDrawer();
    fireEvent.click(screen.getByRole('button', { name: 'Go elsewhere' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes when a link inside it is followed', () => {
    renderDrawer({ lines: [LOOSE] });
    openDrawer();
    fireEvent.click(inDialog().getByRole('link', { name: 'Jasmine Dream' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes when Browse tea is followed from an empty cart', () => {
    renderDrawer();
    openDrawer();
    fireEvent.click(inDialog().getByRole('link', { name: 'Browse tea' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes when a link goes to the page the shopper is already on', () => {
    renderDrawer({ lines: [LOOSE], path: '/products/jasmine-dream' });
    openDrawer();
    fireEvent.click(inDialog().getByRole('link', { name: 'Jasmine Dream' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it.each([
    ['a product link', { lines: [LOOSE] }, 'Jasmine Dream'],
    ['Browse tea', {}, 'Browse tea'],
    ['Browse coffee', {}, 'Browse coffee'],
  ])('stays open when %s is opened in a new tab (Ctrl or Cmd held), since this tab goes nowhere', (_name, options, linkName) => {
    renderDrawer(options);
    openDrawer();
    const link = inDialog().getByRole('link', { name: linkName });

    // The browser would open a tab; jsdom would complain that it cannot navigate.
    const stopTheBrowser = (event) => event.preventDefault();
    document.addEventListener('click', stopTheBrowser);
    try {
      fireEvent.click(link, { ctrlKey: true });
      fireEvent.click(link, { metaKey: true });
    } finally {
      document.removeEventListener('click', stopTheBrowser);
    }
    expect(dialog()).toBeInTheDocument();
  });

  it('can be opened again after it was closed', () => {
    renderDrawer({ lines: [LOOSE] });
    openDrawer();
    fireEvent.click(closeButton());
    openDrawer();
    expect(dialog()).toBeInTheDocument();
  });

  it('locks the page from scrolling while it is open and frees it after', () => {
    renderDrawer({ lines: [LOOSE] });
    expect(document.body.style.overflow).toBe('');
    openDrawer();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.click(closeButton());
    expect(document.body.style.overflow).toBe('');
  });

  it('puts back whatever overflow the page had before', () => {
    document.body.style.overflow = 'scroll';
    renderDrawer({ lines: [LOOSE] });
    openDrawer();
    fireEvent.click(closeButton());
    expect(document.body.style.overflow).toBe('scroll');
    document.body.style.overflow = '';
  });

  it('frees the page if it is taken away while open', () => {
    const { unmount } = renderDrawer({ lines: [LOOSE] });
    openDrawer();
    unmount();
    expect(document.body.style.overflow).toBe('');
  });
});

describe('CartDrawer: focus', () => {
  it('moves focus into the dialog when it opens', () => {
    renderDrawer({ lines: [LOOSE] });
    openDrawer();
    expect(dialog()).toHaveFocus();
  });

  it('gives focus back to the button that opened it, after Escape', () => {
    renderDrawer({ lines: [LOOSE] });
    const opener = openDrawer();
    expect(opener).not.toHaveFocus();
    fireEvent.keyDown(document.activeElement, { key: 'Escape' });
    expect(opener).toHaveFocus();
  });

  it('gives focus back to the opener after the Close button too', () => {
    renderDrawer({ lines: [LOOSE] });
    const opener = openDrawer();
    fireEvent.click(closeButton());
    expect(opener).toHaveFocus();
  });

  it('gives focus back to the opener after a click on the backdrop', () => {
    renderDrawer({ lines: [LOOSE] });
    const opener = openDrawer();
    fireEvent.click(dialog().previousElementSibling);
    expect(opener).toHaveFocus();
  });

  it('keeps Tab inside: from the last control it wraps to the first', () => {
    renderDrawer({ lines: [LOOSE] });
    openDrawer();
    checkoutButton().focus();
    const notPrevented = fireEvent.keyDown(checkoutButton(), { key: 'Tab' });
    expect(notPrevented).toBe(false);
    expect(closeButton()).toHaveFocus();
  });

  it('keeps Shift+Tab inside: from the first control it wraps to the last', () => {
    renderDrawer({ lines: [LOOSE] });
    openDrawer();
    closeButton().focus();
    const notPrevented = fireEvent.keyDown(closeButton(), { key: 'Tab', shiftKey: true });
    expect(notPrevented).toBe(false);
    expect(checkoutButton()).toHaveFocus();
  });

  it('sends Shift+Tab from the dialog itself to the last control', () => {
    renderDrawer({ lines: [LOOSE] });
    openDrawer();
    expect(dialog()).toHaveFocus();
    fireEvent.keyDown(dialog(), { key: 'Tab', shiftKey: true });
    expect(checkoutButton()).toHaveFocus();
  });

  it('pulls focus back in if something on the page behind takes it', () => {
    renderDrawer({ lines: [LOOSE] });
    openDrawer();
    screen.getByRole('button', { name: 'Go elsewhere' }).focus();
    expect(dialog()).toHaveFocus();
  });

  it('sends Tab to the first control when focus has been lost to the page (a removed button)', () => {
    renderDrawer({ lines: [LOOSE] });
    openDrawer();
    dialog().blur();
    expect(document.body).toHaveFocus();
    const notPrevented = fireEvent.keyDown(document.body, { key: 'Tab' });
    expect(notPrevented).toBe(false);
    expect(closeButton()).toHaveFocus();
  });

  it('lets the browser move focus between controls in the middle of the dialog', () => {
    renderDrawer({ lines: [LOOSE] });
    openDrawer();
    closeButton().focus();
    const notPrevented = fireEvent.keyDown(closeButton(), { key: 'Tab' });
    expect(notPrevented).toBe(true);
  });

  it('wraps Tab in an empty cart too, where there are only the Close button and two links', () => {
    renderDrawer();
    openDrawer();
    const links = inDialog().getAllByRole('link');
    links.at(-1).focus();
    fireEvent.keyDown(links.at(-1), { key: 'Tab' });
    expect(closeButton()).toHaveFocus();
  });

  it('does not steal focus back from the page once it is closed', () => {
    renderDrawer({ lines: [LOOSE] });
    openDrawer();
    fireEvent.click(closeButton());
    const other = screen.getByRole('button', { name: 'Go elsewhere' });
    other.focus();
    expect(other).toHaveFocus();
  });
});

describe('CartDrawer: a closed store', () => {
  beforeEach(() => {
    shop.open = false;
  });

  it('shows no lines, prices or Checkout even if a cart was saved while the store was open', () => {
    renderDrawer({ lines: [LOOSE, GROUND] });
    openDrawer();

    expect(inDialog().getByText('Your cart is empty.')).toBeInTheDocument();
    expect(dialog()).not.toHaveTextContent('$');
    expect(inDialog().queryByRole('button', { name: 'Checkout' })).not.toBeInTheDocument();
    expect(inDialog().queryByRole('button', { name: /quantity/i })).not.toBeInTheDocument();
    expect(inDialog().queryByRole('listitem')).not.toBeInTheDocument();
    expect(inDialog().queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText(/add to cart/i)).not.toBeInTheDocument();
  });

  it('never calls the checkout API', () => {
    renderDrawer({ lines: [LOOSE] });
    openDrawer();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not show the notice about dropped lines either', () => {
    renderDrawer({ lines: [line('retired-tea', 'loose-leaf-2oz')] });
    openDrawer();
    expect(inDialog().queryByText(STALE_NOTICE)).not.toBeInTheDocument();
  });

  it('leaves the saved cart alone, for when the store opens', () => {
    renderDrawer({ lines: [LOOSE, GROUND] });
    openDrawer();
    fireEvent.click(closeButton());
    expect(saved()).toEqual([LOOSE, GROUND]);
  });
});
