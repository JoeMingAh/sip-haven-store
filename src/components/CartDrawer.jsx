import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LoaderCircle, Minus, Plus, X } from 'lucide-react';
import { findVariant } from '../../lib/catalog.js';
import { MAX_QTY, isStoreOpen } from '../../lib/store-config.js';
import { useCart } from '../cart/CartContext.jsx';
import { startCheckout } from '../cart/checkout.js';
import { cupWithSteam, placeholderFor } from '../assets/placeholders/index.js';
import { formatLabel, formatPrice } from '../format.js';
import FreeShippingProgress from './FreeShippingProgress.jsx';

// DRAFT COPY: the wording here needs Joseph's approval.

// Controls Tab can land on.
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const FILLED_BUTTON =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-sage-deep px-7 text-base font-semibold text-cream hover:bg-ink disabled:cursor-wait disabled:opacity-70';
const LINK_BUTTON =
  'inline-flex min-h-11 items-center rounded-full px-6 text-sm font-semibold text-ink';
const ICON_BUTTON =
  'inline-flex h-11 w-11 items-center justify-center text-sage-deep hover:bg-sage-tint disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';

// Keep Tab and Shift+Tab inside the dialog: from the last control it wraps to the
// first, and from the first (or the dialog itself) Shift+Tab wraps to the last. When
// focus has gone astray, such as onto the page behind or nowhere at all after the
// button that had it was removed, Tab comes back in at the start.
function keepTabInside(event, panel) {
  const controls = [...panel.querySelectorAll(FOCUSABLE)];
  if (controls.length === 0) {
    event.preventDefault();
    panel.focus();
    return;
  }

  const first = controls[0];
  const last = controls[controls.length - 1];
  const active = document.activeElement;
  const isInside = panel.contains(active);

  if (event.shiftKey) {
    if (active === first || active === panel || !isInside) {
      event.preventDefault();
      last.focus();
    }
  } else if (active === last || !isInside) {
    event.preventDefault();
    first.focus();
  }
}

// Everything that makes the panel a modal dialog, from the moment it is on screen
// until it goes: focus moves into it and comes back to whatever opened it, Escape
// closes it, Tab stays inside it, and the page behind does not scroll.
function useModal(panelRef, onClose) {
  useEffect(() => {
    const panel = panelRef.current;
    // Whatever had focus when the cart opened: the Cart button, say, or Add to cart.
    const opener = document.activeElement;
    const pageOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';
    panel.focus();

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'Tab') keepTabInside(event, panel);
    }
    // Focus pushed onto the page behind goes back to the dialog.
    function handleFocusIn(event) {
      if (!panel.contains(event.target)) panel.focus();
    }
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', handleFocusIn);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocusIn);
      document.body.style.overflow = pageOverflow;
      // Nothing had focus when the cart opened from a route (see Cart.jsx): the opener is
      // then the page itself, and there is nothing to give focus back to.
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [panelRef, onClose]);
}

// The shopper went somewhere else while the cart was open: followed a link in it, or
// pressed Back. A link opened in a new tab goes nowhere in this one, so it leaves the
// cart open. (Not an onClick on each link: that would close the cart on those too.)
function useCloseOnNavigation(onClose) {
  const { key } = useLocation();
  const openedAt = useRef(key);
  useEffect(() => {
    if (key !== openedAt.current) onClose();
  }, [key, onClose]);
}

function EmptyCart() {
  return (
    <div className="py-10 text-center">
      <img src={cupWithSteam} alt="" className="mx-auto h-20 w-20" />
      <p className="mt-4 font-serif text-xl font-semibold text-sage-deep">Your cart is empty.</p>
      <p className="mt-2 text-base">Find something to sip.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link to="/tea" className={`${LINK_BUTTON} bg-sage-tint hover:bg-wood`}>
          Browse tea
        </Link>
        <Link to="/coffee" className={`${LINK_BUTTON} bg-wood hover:bg-sage-tint`}>
          Browse coffee
        </Link>
      </div>
    </div>
  );
}

// One line of the cart. Names, sizes and prices come from the lineup; the cart only
// remembers which variant and how many.
function CartLine({ line }) {
  const { setQty, remove } = useCart();
  const found = findVariant(line.slug, line.variantId);
  if (!found) return null;

  const { product, variant } = found;
  const label = `${product.name} (${formatLabel(variant.format)}, ${variant.size_label})`;
  const photo = product.images?.[0];

  function handleRemove(event) {
    // The button that has focus goes with the line. Keep focus in the dialog.
    event.currentTarget.closest('[role="dialog"]')?.focus();
    remove(line.slug, line.variantId);
  }

  return (
    <li className="flex gap-4 border-b border-wood py-4 last:border-b-0">
      <img
        src={photo ?? placeholderFor(product)}
        alt=""
        className={`h-20 w-20 shrink-0 rounded-2xl ${
          product.category === 'coffee' ? 'bg-wood' : 'bg-sage-tint'
        } ${photo ? 'object-cover' : 'object-contain p-2'}`}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              to={`/products/${product.slug}`}
              className="font-serif text-lg font-semibold leading-snug text-sage-deep hover:underline"
            >
              {product.name}
            </Link>
            <p className="text-sm">
              {formatLabel(variant.format)}, {variant.size_label}
            </p>
            <p className="text-sm">{formatPrice(variant.price_cents)} each</p>
          </div>
          <p className="shrink-0 font-semibold">{formatPrice(variant.price_cents * line.qty)}</p>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4">
          <div
            role="group"
            aria-label={`Quantity of ${label}`}
            className="inline-flex items-center overflow-hidden rounded-full border-2 border-sage"
          >
            <button
              type="button"
              aria-label={`Decrease quantity of ${label}`}
              disabled={line.qty <= 1}
              onClick={() => setQty(line.slug, line.variantId, line.qty - 1)}
              className={ICON_BUTTON}
            >
              <Minus aria-hidden="true" size={16} />
            </button>
            <span aria-live="polite" className="min-w-8 text-center font-semibold">
              {line.qty}
            </span>
            <button
              type="button"
              aria-label={`Increase quantity of ${label}`}
              disabled={line.qty >= MAX_QTY}
              onClick={() => setQty(line.slug, line.variantId, line.qty + 1)}
              className={ICON_BUTTON}
            >
              <Plus aria-hidden="true" size={16} />
            </button>
          </div>

          <button
            type="button"
            aria-label={`Remove ${label} from cart`}
            onClick={handleRemove}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-sage-deep underline underline-offset-4 hover:no-underline"
          >
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}

// What a failed checkout was about: its text, and the cart it was about. When the
// cart changes the text no longer applies and is not shown.
const NO_FAILURE = { message: '', lines: null };

// The subtotal, the shipping bar and the Checkout button, which asks the server for a
// Stripe Checkout page and sends the shopper there. The button is off while a request
// is out, and stays off once Stripe has the shopper: the browser is on its way.
function CartSummary({ lines, subtotalCents }) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(NO_FAILURE);
  // A second click can arrive before the page has re-rendered with the button off.
  const inFlight = useRef(false);

  const error = failure.lines === lines ? failure.message : '';

  // Back from Stripe with the page kept in the browser's cache: nothing reloads, so
  // the button would be left off for good.
  useEffect(() => {
    function handlePageShow(event) {
      if (event.persisted) {
        inFlight.current = false;
        setBusy(false);
      }
    }
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  async function handleCheckout() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFailure(NO_FAILURE);

    const result = await startCheckout(lines);
    if (result.url) {
      window.location.assign(result.url);
      return;
    }

    inFlight.current = false;
    setBusy(false);
    setFailure({ message: result.error, lines });
  }

  return (
    <div className="border-t border-wood px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
      <FreeShippingProgress subtotalCents={subtotalCents} />

      <p className="mt-4 flex items-baseline justify-between text-lg font-semibold">
        <span>Subtotal</span> <span>{formatPrice(subtotalCents)}</span>
      </p>
      <p className="mt-1 text-sm">Taxes calculated at checkout</p>

      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-red-800">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleCheckout}
        disabled={busy}
        aria-busy={busy}
        className={`${FILLED_BUTTON} mt-4 w-full`}
      >
        {busy && <LoaderCircle aria-hidden="true" size={20} className="animate-spin motion-reduce:animate-none" />}
        Checkout
      </button>
    </div>
  );
}

// The open cart: a dimmed page and a panel sliding in from the right (the full width
// of a phone, and a 28rem column on anything wider). It is only in the page while the
// cart is open, so whatever it keeps for one visit, like a checkout error, starts
// fresh each time.
//
// A closed store shows an empty cart whatever was saved, with no prices and no way
// to check out; the saved cart is left alone for when the store opens.
function CartPanel() {
  const { lines, subtotalCents, notice, close } = useCart();
  const titleId = useId();
  const panelRef = useRef(null);
  useModal(panelRef, close);
  useCloseOnNavigation(close);

  const storeOpen = isStoreOpen();
  const hasLines = storeOpen && lines.length > 0;

  return (
    <div className="fixed inset-0 z-40">
      {/* The dimmed page. A click on it closes the cart; the keyboard has Escape and the Close button. */}
      <div onClick={close} className="absolute inset-0 bg-ink/40 motion-safe:animate-fade-in" />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-cream shadow-2xl focus:outline-none motion-safe:animate-slide-in-right"
      >
        <div className="flex items-center justify-between border-b border-wood py-2 pl-5 pr-2">
          <h2 id={titleId} className="font-serif text-2xl font-semibold text-sage-deep">
            Your cart
          </h2>
          <button
            type="button"
            aria-label="Close cart"
            onClick={close}
            className={`${ICON_BUTTON} rounded-full`}
          >
            <X aria-hidden="true" size={22} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {storeOpen && notice && (
            <p role="status" className="mb-4 rounded-2xl bg-wood px-4 py-3 text-sm font-semibold">
              {notice}
            </p>
          )}

          {hasLines ? (
            <ul aria-label="Items in your cart">
              {lines.map((line) => (
                <CartLine key={`${line.slug}/${line.variantId}`} line={line} />
              ))}
            </ul>
          ) : (
            <EmptyCart />
          )}
        </div>

        {hasLines && <CartSummary lines={lines} subtotalCents={subtotalCents} />}
      </div>
    </div>
  );
}

/**
 * The cart as a slide-out dialog, opened with useCart().open(). It lists the lines
 * with quantity steppers (1 to MAX_QTY) and Remove, the subtotal, how close the cart is
 * to free shipping, and a Checkout button. Render it once, inside the router and the
 * CartProvider (Layout does).
 */
export default function CartDrawer() {
  const { isOpen } = useCart();
  return isOpen ? <CartPanel /> : null;
}
