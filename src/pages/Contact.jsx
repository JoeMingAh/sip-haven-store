import { CONTACT_EMAIL } from '../../lib/store-config.js';

// Filled buttons use sage-deep behind cream text, which is the pairing that passes
// WCAG AA (see tailwind.config.js). The break and padding let a long address wrap
// inside a narrow screen instead of running off it.
const EMAIL_BUTTON =
  'inline-flex min-h-12 max-w-full break-all items-center rounded-full bg-sage-deep px-7 py-2 text-base font-semibold text-cream hover:bg-ink';

const BODY = 'mt-5 text-pretty text-lg leading-relaxed';

/**
 * /contact. One way to reach us: a mailto link to CONTACT_EMAIL (lib/store-config.js).
 * There is deliberately no form, so nothing is stored here and nothing needs a spam
 * filter. It promises no reply time.
 */
export default function Contact() {
  return (
    <div className="mx-auto max-w-prose px-4 py-10 md:py-14">
      {/* DRAFT COPY: needs Joseph's approval */}
      <h1 className="text-balance font-serif text-4xl font-semibold leading-tight text-sage-deep md:text-5xl">
        Contact us
      </h1>
      <p className={BODY}>
        We'd love to hear from you. Whether you have a question about an order, want to know more
        about something in the shop, or simply want to say hello, send us an email.
      </p>

      <p className="mt-8">
        <a href={`mailto:${CONTACT_EMAIL}`} className={EMAIL_BUTTON}>
          {CONTACT_EMAIL}
        </a>
      </p>

      <p className={BODY}>
        If your message is about an order, it helps to tell us the email address you used at
        checkout, so we can find it quickly.
      </p>
      <p className={BODY}>We'll get back to you as soon as we can.</p>
    </div>
  );
}
