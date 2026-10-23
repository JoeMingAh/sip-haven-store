// DRAFT COPY: needs Joseph's approval.
//
// The title and description each page shows in a browser tab, in search results and
// when a link is shared (the Open Graph title and description are the same words).
// Edit the words freely; keep every title and every description different from the
// others (src/pageMeta.test.js checks that), plain ASCII, and a description at most
// about 160 characters so search results do not cut it off.
//
// The keys are the pages' addresses. The build writes each page's HTML with these
// tags (lib/page-html.js), and the app swaps them as a shopper moves between pages
// (src/components/PageMeta.jsx).

/** Used by every page not listed below: product pages, the cart, the 404 page. */
export const DEFAULT_PAGE_META = {
  title: 'Sip Haven',
  description:
    'Sip Haven is an online shop for tea and coffee, made for slow mornings and long talks.',
};

export const PAGE_META = {
  '/': {
    title: 'Sip Haven | Tea and coffee for slow mornings',
    description:
      'Loose leaf tea, tea bags, K-Cups and whole bean or ground coffee, chosen for slow mornings and long talks. Find your next favorite cup at Sip Haven.',
  },
  '/tea': {
    title: 'Tea | Sip Haven',
    description:
      'Sip Haven tea in loose leaf, tea bags and K-Cups: a calm pot for a Sunday afternoon or a cozy cup to end the day.',
  },
  '/coffee': {
    title: 'Coffee | Sip Haven',
    description:
      'Sip Haven coffee, whole bean or ground, for the first quiet mug before the house wakes up and every slow pour after it.',
  },
  '/quiz': {
    title: 'Find your cup: tea and coffee quiz | Sip Haven',
    description:
      'Answer six quick questions about mood, caffeine, flavor and aroma, and we will point you toward a Sip Haven tea or coffee you might love.',
  },
  '/our-story': {
    title: 'Our story | Sip Haven',
    description:
      'Why we started Sip Haven: a quiet corner where the kettle is always on, and a collection of teas and coffees for slow mornings and long talks.',
  },
  '/contact': {
    title: 'Contact us | Sip Haven',
    description:
      'Questions about an order or something in the shop, or just want to say hello? Email the Sip Haven team and we will get back to you soon.',
  },
  '/shipping-returns': {
    title: 'Shipping and returns | Sip Haven',
    description:
      'Sip Haven ships to the United States. Orders of $50 or more ship free, and if anything arrives damaged, contact us and we will make it right.',
  },
  '/privacy': {
    title: 'Privacy | Sip Haven',
    description:
      'What Sip Haven keeps when you join our email list or place an order, who handles it, and how to unsubscribe or have your email address removed.',
  },
};
