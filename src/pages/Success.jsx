import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../cart/CartContext.jsx';
import { cupWithSteam } from '../assets/placeholders/index.js';

// Filled buttons use sage-deep behind cream text, which is the pairing that passes
// WCAG AA (see tailwind.config.js).
const FILLED_BUTTON =
  'inline-flex min-h-12 items-center rounded-full bg-sage-deep px-7 text-base font-semibold text-cream hover:bg-ink';
const OUTLINE_BUTTON =
  'inline-flex min-h-12 items-center rounded-full border-2 border-sage-deep px-7 text-base font-semibold text-sage-deep hover:bg-sage-tint';

const BODY = 'mx-auto mt-4 max-w-md text-pretty text-lg leading-relaxed';

/**
 * /success. Where Stripe sends a shopper once the payment is done (success_url in
 * api/checkout.js). It thanks them, says the receipt comes from Stripe, and empties
 * the cart, since that order is placed.
 *
 * The address carries a session_id from Stripe. It is not read, shown or sent
 * anywhere: nothing is fetched, because there is no server route that could vouch for
 * it and the page needs nothing from it.
 */
export default function Success() {
  const { clear } = useCart();

  // Once, when the page opens. `clear` keeps the same identity for the life of the
  // cart (see CartContext), so this does not run again, and a cart that changes later
  // in the visit, from another tab say, is left alone.
  useEffect(() => {
    clear();
  }, [clear]);

  return (
    <div className="mx-auto max-w-prose px-4 py-12 text-center md:py-16">
      {/* DRAFT COPY: needs Joseph's approval */}
      <img src={cupWithSteam} alt="" className="mx-auto h-24 w-24" />
      <h1 className="mt-4 text-balance font-serif text-4xl font-semibold leading-tight text-sage-deep md:text-5xl">
        Thank you for your order
      </h1>
      <p className={BODY}>
        We're so glad you chose Sip Haven. Your order is in, and we'll start getting it ready to
        send.
      </p>
      <p className={BODY}>
        Your receipt will come from Stripe, by email, to the address you gave at checkout. If you
        don't see it, take a look in your spam folder.
      </p>
      <p className={BODY}>
        Questions about your order?{' '}
        <Link
          to="/contact"
          className="font-semibold text-sage-deep underline underline-offset-4 hover:no-underline"
        >
          Contact us
        </Link>{' '}
        and we'll be glad to help.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/tea" className={FILLED_BUTTON}>
          Browse tea
        </Link>
        <Link to="/coffee" className={OUTLINE_BUTTON}>
          Browse coffee
        </Link>
      </div>
    </div>
  );
}
