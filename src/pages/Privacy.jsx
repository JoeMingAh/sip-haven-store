import { CONTACT_EMAIL } from '../../lib/store-config.js';

const SECTION_HEADING = 'mt-10 font-serif text-2xl font-semibold text-sage-deep';
const BODY = 'mt-4 text-pretty text-lg leading-relaxed';

/**
 * /privacy. In plain words, what Sip Haven keeps and who handles it:
 *   - the email list: the address, stored in Resend, used for Sip Haven updates
 *     (api/subscribe.js);
 *   - an order: Stripe takes the payment and the shipping address, Sip Haven never
 *     sees a card number, and the order notice (api/webhook.js) gives us the name,
 *     email, address and items we need to send it;
 *   - the cart: kept in the visitor's own browser (src/cart/cartStorage.js).
 *
 * It makes no claim of legal compliance and states no more than the code does. If the
 * site starts collecting something new, this page has to say so.
 */
export default function Privacy() {
  return (
    <div className="mx-auto max-w-prose px-4 py-10 md:py-14">
      {/* DRAFT COPY: needs Joseph's approval */}
      <h1 className="text-balance font-serif text-4xl font-semibold leading-tight text-sage-deep md:text-5xl">
        Privacy
      </h1>
      <p className="mt-4 text-pretty text-xl leading-relaxed">
        Here is what Sip Haven keeps when you join our list or place an order, and who handles it.
        We have tried to keep it short and plain.
      </p>

      <h2 className={SECTION_HEADING}>Our email list</h2>
      <p className={BODY}>
        If you join the list, we save your email address. It is stored with Resend, the service we
        use to keep the list and send email. We'll only use it to send you Sip Haven updates.
      </p>
      <p className={BODY}>
        You can unsubscribe at any time: use the link in our emails, or write to us and we'll take
        you off the list.
      </p>

      <h2 className={SECTION_HEADING}>When you place an order</h2>
      <p className={BODY}>
        Checkout is handled by Stripe, a payment service. You enter your payment details and
        shipping address on Stripe's checkout page, and Stripe processes your payment. Sip Haven
        never sees your card number.
      </p>
      <p className={BODY}>
        We receive your name, email address, shipping address and what you ordered, so we can send
        your order to you.
      </p>

      <h2 className={SECTION_HEADING}>Your cart</h2>
      <p className={BODY}>
        While you shop, your cart is saved in your own browser, in what is called local storage, so
        it is still there if you come back. It stays on your device and is not sent to us until you
        check out. Clearing your browser's saved data removes it.
      </p>

      <h2 className={SECTION_HEADING}>Questions</h2>
      <p className={BODY}>
        If you have a question about your information, or you would like your email address
        removed, write to us at{' '}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="font-semibold text-sage-deep underline underline-offset-4 hover:no-underline"
        >
          {CONTACT_EMAIL}
        </a>
        .
      </p>
    </div>
  );
}
