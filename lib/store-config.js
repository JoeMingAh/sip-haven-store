// Storefront settings that the React app, the /api functions and the scripts
// all have to agree on. Change them here and nowhere else.

// Placeholders until Joseph confirms the real shipping terms.
export const FREE_SHIPPING_CENTS = 5000;
export const FLAT_SHIPPING_CENTS = 695;

// The most units of one variant that can go in a single cart line.
export const MAX_QTY = 20;

// Placeholder until Joseph confirms the public contact address.
export const CONTACT_EMAIL = 'hello@siphaven.com';

// Stripe product tax code for any product that does not set its own `tax_code`.
// txcd_40040000 is "Food for Non-Immediate Consumption": food and beverage sold
// at retail for use off the premises, which is how tea and coffee are sold here.
// Stripe also has narrower codes a product can set itself: txcd_41050008 (Tea
// Leaves or Tea Bags) and txcd_41050006 (Coffee Beans or Ground Coffee).
// Source: https://docs.stripe.com/tax/tax-codes (checked 2026-10-18).
export const DEFAULT_TAX_CODE = 'txcd_40040000';

// One function for every runtime. Node (the /api functions and scripts) sets
// STORE_OPEN; the browser bundle only sees VITE_STORE_OPEN, which Vite inlines
// at build time. Either one being exactly 'true' opens the store, and anything
// else (unset, 'TRUE', '1') leaves it closed. Setting STORE_OPEN alone is enough:
// vite.config.js copies it into VITE_STORE_OPEN for the build unless that is set
// itself, and fails a build where the two differ (lib/store-flag.js), so the pages
// and /api/checkout cannot disagree.
// `globalThis.process` instead of bare `process` so a browser, which has no
// process global, gets undefined rather than a ReferenceError.
export function isStoreOpen() {
  const nodeFlag = globalThis.process?.env?.STORE_OPEN === 'true';
  const browserFlag = import.meta.env?.VITE_STORE_OPEN === 'true';
  return nodeFlag || browserFlag;
}
