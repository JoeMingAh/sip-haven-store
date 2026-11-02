// Offers: things the shop sells that are not part of the lineup (src/data/lineup.json).
// They are not listed on /tea or /coffee, not matched by the quiz and not in the
// sitemap's product pages; each has a page of its own. The cart, the cart drawer and
// /api/checkout find them through findVariant (lib/catalog.js), exactly as they find
// a lineup variant, so a cart line is still only { slug, variantId, qty } and the
// price always comes from here, never from the browser.
//
// An offer variant has the lineup's variant fields (id, format, size_label,
// price_cents, stripe_price_id) and may add:
//   free_shipping  true: any cart holding it ships free, whatever the subtotal
//   credit_code    a promotion code enclosed in the box, for a later order
//
// The Tasting Flight ($42) is sold from /tasting-flight (src/pages/TastingFlight.jsx).
//
// Before it can really be bought:
//   1. Stripe live keys must be set (STRIPE_SECRET_KEY) and the store opened (STORE_OPEN).
//   2. Create the $42.00 price in Stripe (tax exclusive, like load-lineup makes them)
//      and put its id in stripe_price_id below. Until then the variant counts as not
//      purchasable (a blank id is none): the page's button stays off, and the cart and
//      /api/checkout refuse it.
//   3. Create a RESERVE15 promotion code in Stripe ($15 off, valid 21 days). Checkout
//      already accepts promotion codes (allow_promotion_codes in api/checkout.js); the
//      code is printed on the card in the box and redeemed on a later order, not this one.

export const TASTING_FLIGHT_SLUG = 'tasting-flight';
export const TASTING_FLIGHT_VARIANT_ID = 'flight-4-tins';
export const TASTING_FLIGHT_PATH = '/tasting-flight';

export const TASTING_FLIGHT = {
  slug: TASTING_FLIGHT_SLUG,
  name: 'Taiwanese Tasting Flight',
  category: 'tea',
  // Where the cart drawer links the line to, in place of /products/:slug.
  path: TASTING_FLIGHT_PATH,
  images: [],
  variants: [
    {
      id: TASTING_FLIGHT_VARIANT_ID,
      format: 'loose-leaf',
      size_label: 'Four origin tins',
      price_cents: 4200,
      free_shipping: true,
      credit_code: 'RESERVE15',
      // Set once the price exists in Stripe (step 2 above).
      stripe_price_id: '',
    },
  ],
};

export const OFFERS = [TASTING_FLIGHT];
