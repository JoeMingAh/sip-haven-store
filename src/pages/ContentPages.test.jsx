import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../router.jsx';

// The shipping page and the contact page print values from lib/store-config.js. The
// tests change those values here, to show that nothing is typed into a page by hand.
const config = vi.hoisted(() => ({ freeCents: 5000, flatCents: 695, email: 'hello@siphaven.com' }));
vi.mock('../../lib/store-config.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FREE_SHIPPING_CENTS() {
    return config.freeCents;
  },
  get FLAT_SHIPPING_CENTS() {
    return config.flatCents;
  },
  get CONTACT_EMAIL() {
    return config.email;
  },
}));

beforeEach(() => {
  config.freeCents = 5000;
  config.flatCents = 695;
  config.email = 'hello@siphaven.com';
});

function renderAt(path) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

const main = () => within(screen.getByRole('main'));
const mainText = () => screen.getByRole('main').textContent;
// Heading levels in page order, e.g. [1, 2, 2, 2].
const levels = () => main().getAllByRole('heading').map((heading) => Number(heading.tagName[1]));

const PAGES = [
  { path: '/our-story', title: 'Our story' },
  { path: '/contact', title: 'Contact us' },
  { path: '/shipping-returns', title: 'Shipping and returns' },
  { path: '/privacy', title: 'Privacy' },
];

describe.each(PAGES)('$path', ({ path, title }) => {
  it('is a page inside the layout with exactly one h1', () => {
    renderAt(path);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(main().getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(main().getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
  });

  it('is not the not-found page', () => {
    renderAt(path);
    expect(screen.queryByText(/couldn't find that page/i)).not.toBeInTheDocument();
  });

  it('starts with its h1 and never skips a heading level', () => {
    renderAt(path);
    const found = levels();
    expect(found[0]).toBe(1);
    found.slice(1).forEach((level, index) => {
      expect(level, `heading ${index + 2} follows a level ${found[index]} heading`).toBeLessThanOrEqual(
        found[index] + 1,
      );
    });
  });

  it('keeps its text to a readable width', () => {
    renderAt(path);
    const root = screen.getByRole('main').firstElementChild;
    expect(root).toHaveClass('max-w-prose');
  });

  it('has nothing to buy', () => {
    renderAt(path);
    expect(screen.queryByText(/add to cart/i)).not.toBeInTheDocument();
  });
});

describe('Our story', () => {
  const APPROVED = [
    'Our story',
    'Sip Haven is a place to slow down and remember.',
    'Life is a sum of all your experiences. A good cup gives you a reason to stop, take a breath and let it all catch up with you.',
    "A mug of coffee before the house wakes up. A pot of loose-leaf tea on a Sunday afternoon. Small rituals that leave you grateful for how far you've come.",
    "We're building a collection of loose-leaf tea, tea bags, tea K-Cups, and whole bean and ground coffee for those pauses.",
    "Not sure where to start? Try the quiz and we'll point you toward a cup you might love.",
    'Take the quiz',
    'Browse tea',
    'Browse coffee',
    'Questions',
    'What is Sip Haven?',
    'Sip Haven is an online tea and coffee store. We make tea and coffee for slow mornings, long talks and quiet moments to look back on.',
    'What does Sip Haven sell?',
    "Loose-leaf tea, tea bags and tea K-Cups, plus whole bean and ground coffee. Our first collection is on the way. Leave your email and we'll let you know when it's ready.",
    'How do I pick a tea or coffee?',
    "Take our quick quiz. Answer a few questions and we'll point you toward a cup you might love.",
  ];

  it('shows the approved story, with the questions as headings and the answers as text', () => {
    renderAt('/our-story');
    for (const text of APPROVED) expect(mainText()).toContain(text);
    expect(main().getByRole('heading', { level: 1, name: 'Our story' })).toBeInTheDocument();
    expect(main().getByText('Sip Haven is a place to slow down and remember.').tagName).toBe('P');
    expect(screen.getByRole('main').querySelector('img')).toHaveAttribute('alt', '');
    expect(
      main()
        .getAllByRole('heading')
        .map((heading) => heading.textContent),
    ).toEqual([
      'Our story',
      'Questions',
      'What is Sip Haven?',
      'What does Sip Haven sell?',
      'How do I pick a tea or coffee?',
    ]);
    // The answers are on the page, not tucked into a control that needs JavaScript.
    expect(main().queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('main').querySelector('details')).toBeNull();
    expect(screen.getByRole('main').querySelector('blockquote')).toBeNull();
  });

  it('states no facts that nobody has given us: no number, year, farm, award or founder', () => {
    renderAt('/our-story');
    // Any digit could be a year or a count.
    expect(mainText()).not.toMatch(/\d/);
    expect(mainText()).not.toMatch(/farm|award|founder|founded|customers/i);
  });

  it('offers the quiz, tea and coffee as the live page does', () => {
    renderAt('/our-story');
    const quiz = main().getByRole('link', { name: 'Take the quiz' });
    const tea = main().getByRole('link', { name: 'Browse tea' });
    const coffee = main().getByRole('link', { name: 'Browse coffee' });
    expect(quiz).toHaveAttribute('href', '/quiz');
    expect(quiz).toHaveClass('bg-sage-deep', 'text-cream', 'rounded-full');
    expect(tea).toHaveAttribute('href', '/tea');
    expect(tea).toHaveClass('border-sage-deep', 'text-sage-deep', 'rounded-full');
    expect(coffee).toHaveAttribute('href', '/coffee');
    expect(coffee).toHaveClass('border-sage-deep', 'text-sage-deep', 'rounded-full');
    expect(main().getAllByRole('link')).toHaveLength(3);
  });

  it('adds Organization and FAQPage structured data, and takes it away on leaving', async () => {
    const router = renderAt('/our-story');
    const organization = document.getElementById('sip-haven-organization-jsonld');
    const faq = document.getElementById('sip-haven-faqpage-jsonld');
    expect(JSON.parse(organization.textContent)).toMatchObject({
      '@type': 'Organization',
      name: 'Sip Haven',
      legalName: 'Sip Haven Co. LLC',
      url: 'https://www.siphaven.com',
    });
    expect(JSON.parse(faq.textContent).mainEntity).toHaveLength(3);
    expect(faq.textContent).toContain('What is Sip Haven?');

    await act(() => router.navigate('/contact'));
    expect(document.getElementById('sip-haven-organization-jsonld')).toBeNull();
    expect(document.getElementById('sip-haven-faqpage-jsonld')).toBeNull();
  });
});

describe('Contact', () => {
  it('links to the contact email with mailto, and shows the address as the link text', () => {
    renderAt('/contact');
    const link = main().getByRole('link', { name: 'hello@siphaven.com' });
    expect(link).toHaveAttribute('href', 'mailto:hello@siphaven.com');
  });

  it('follows CONTACT_EMAIL in lib/store-config.js', () => {
    config.email = 'joseph@example.com';
    renderAt('/contact');
    expect(main().getByRole('link', { name: 'joseph@example.com' })).toHaveAttribute(
      'href',
      'mailto:joseph@example.com',
    );
    expect(main().queryByText('hello@siphaven.com')).not.toBeInTheDocument();
  });

  it('has no form: no field and no button to fill in', () => {
    renderAt('/contact');
    const page = screen.getByRole('main');
    expect(page.querySelector('form')).toBeNull();
    expect(main().queryByRole('textbox')).not.toBeInTheDocument();
    expect(main().queryByRole('button')).not.toBeInTheDocument();
  });

  it('has just the one way to reach us, so there is one mailto link', () => {
    renderAt('/contact');
    const mailto = main()
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href').startsWith('mailto:'));
    expect(mailto).toHaveLength(1);
  });

  it('promises no reply time', () => {
    renderAt('/contact');
    expect(mainText()).not.toMatch(/\b\d+\b|hours?|days?|business|same[- ]day|24/i);
  });
});

describe('Shipping and returns', () => {
  it('states the free-shipping threshold and the flat rate', () => {
    renderAt('/shipping-returns');
    expect(mainText()).toContain('$50');
    expect(mainText()).toContain('$6.95');
  });

  it('writes them in the shop\'s way: whole dollars without cents, the flat rate with them', () => {
    renderAt('/shipping-returns');
    expect(mainText()).not.toContain('$50.00');
    expect(mainText()).toContain('$6.95');
  });

  it('follows lib/store-config.js, so changing the config changes the page', () => {
    config.freeCents = 7500;
    config.flatCents = 895;
    renderAt('/shipping-returns');
    expect(mainText()).toContain('$75');
    expect(mainText()).toContain('$8.95');
    expect(mainText()).not.toContain('$50');
    expect(mainText()).not.toContain('$6.95');
  });

  it('keeps the cents on a threshold that is not a whole dollar', () => {
    config.freeCents = 4950;
    renderAt('/shipping-returns');
    expect(mainText()).toContain('$49.50');
  });

  it('names no dollar amount but those two', () => {
    renderAt('/shipping-returns');
    expect(mainText().match(/\$\d+(?:,\d{3})*(?:\.\d{2})?/g)).toEqual(['$50', '$6.95']);
  });

  it('says that orders ship within the United States', () => {
    renderAt('/shipping-returns');
    expect(mainText()).toMatch(/United States/);
  });

  it('makes one promise about a problem order, in the words Joseph gave', () => {
    renderAt('/shipping-returns');
    expect(mainText()).toContain("Contact us if anything arrives damaged and we'll make it right.");
  });

  it('sends "Contact us" to the contact page', () => {
    renderAt('/shipping-returns');
    expect(main().getByRole('link', { name: 'Contact us' })).toHaveAttribute('href', '/contact');
  });

  it('promises no return window, refund or exchange, and drops the old 30-day claim', () => {
    renderAt('/shipping-returns');
    expect(mainText()).not.toMatch(/30[- ]?day/i);
    expect(mainText()).not.toMatch(/refund|money[- ]back|exchange|free returns?|full credit/i);
  });

  it('promises no delivery time', () => {
    renderAt('/shipping-returns');
    expect(mainText()).not.toMatch(/\b(days?|weeks?|hours?|business|overnight|next[- ]day|express)\b/i);
  });
});

describe('Privacy', () => {
  it('explains what the email signup keeps: the address, in Resend, for Sip Haven updates', () => {
    renderAt('/privacy');
    expect(mainText()).toMatch(/email address/i);
    expect(mainText()).toMatch(/Resend/);
    expect(mainText()).toMatch(/Sip Haven updates/i);
  });

  it('says a visitor can unsubscribe at any time', () => {
    renderAt('/privacy');
    expect(mainText()).toMatch(/unsubscribe at any time/i);
  });

  it('explains what checkout handles: Stripe takes the payment and the shipping address', () => {
    renderAt('/privacy');
    expect(mainText()).toMatch(/Stripe/);
    expect(mainText()).toMatch(/shipping address/i);
    expect(mainText()).toMatch(/payment/i);
  });

  it('says Sip Haven never sees a card number', () => {
    renderAt('/privacy');
    expect(mainText()).toMatch(/never sees? your card number/i);
  });

  it('says what Sip Haven does receive of an order, so the page is not misleading', () => {
    renderAt('/privacy');
    expect(mainText()).toMatch(/we receive your name/i);
    expect(mainText()).toMatch(/what you ordered/i);
  });

  it('says the cart is saved in the visitor\'s own browser', () => {
    renderAt('/privacy');
    expect(mainText()).toMatch(/cart/i);
    expect(mainText()).toMatch(/your own browser/i);
    expect(mainText()).toMatch(/local storage/i);
  });

  it('makes no claim of legal compliance', () => {
    renderAt('/privacy');
    expect(mainText()).not.toMatch(/GDPR|CCPA|COPPA|compliant|compliance|legal/i);
  });

  it('offers the contact email for questions and removal', () => {
    renderAt('/privacy');
    expect(main().getByRole('link', { name: 'hello@siphaven.com' })).toHaveAttribute(
      'href',
      'mailto:hello@siphaven.com',
    );
  });

  it('is split under headings, one for each thing it covers', () => {
    renderAt('/privacy');
    expect(main().getAllByRole('heading', { level: 2 }).length).toBeGreaterThanOrEqual(3);
  });
});
