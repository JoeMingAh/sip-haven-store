# Sip Haven Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild siphaven.com as a warm Garden Teahouse tea + coffee shop whose catalog comes from one lineup file, launching in coming-soon mode.

**Architecture:** A shared `lib/` module (catalog + store config) is the single source of truth, imported by the React SPA, the Vercel `api/` functions, and Node scripts in `scripts/`. The SPA moves from one 1,395-line `src/App.jsx` with a `view` state to react-router pages and small components. Products live in `src/data/lineup.json`, produced from Joseph's CSV and synced to Stripe by `npm run load-lineup`.

**Tech Stack:** Vite 8, React 19, react-router-dom 7, Tailwind 3.4, Vitest 4 (+ @testing-library/react, jsdom for UI tests), Stripe 22 (Checkout, Tax, promotion codes), Resend 6 (order email, Audiences), csv-parse.

**Spec:** `docs/superpowers/specs/2026-10-18-sip-haven-redesign-design.md`

## Global Constraints

- No Art of Tea text, images, logos or product names anywhere. All copy original.
- No invented claims: no ratings, review counts, farm counts, awards, press logos, testimonials.
- No "Add to cart" on anything not purchasable. When `storeOpen` is false, no prices or Add to cart render anywhere and `/api/checkout` refuses.
- Stripe test keys only. `scripts/load-lineup.js` refuses an `sk_live_` key unless run with `--live`.
- No deploy to production, no email to customers, no live Stripe objects without Joseph's explicit yes. Work on branch `redesign-spec` (or a branch cut from it); never push to `master`.
- Palette (refine for WCAG AA): cream `#F7F4EC`, sage `#6F8466`, sage-deep `#4E5F47`, wood `#E9DCC8`, sage-tint `#DDE5D3`, ink `#2F3A2E`. Serif headings (Lora, loaded from Google Fonts), sans body (Nunito Sans).
- Tea formats: `loose-leaf`, `tea-bags`, `k-cup`. Coffee formats: `whole-bean`, `ground`. Category is `tea` | `coffee` only.
- One-time purchase only. Field `subscribable` is accepted in data and ignored.
- Free-shipping threshold and flat rate live in one place: `lib/store-config.js` (`FREE_SHIPPING_CENTS = 5000`, `FLAT_SHIPPING_CENTS = 695`, both placeholders).
- Existing `npm test` must pass at the end of every task; `npm run build` and `npm run lint` must pass at the end of Tasks 7–13.

## Review Focus

1. **Direct POST to `/api/checkout` while the store is closed** → 403 `{ error: 'Store is not open yet.' }` (Task 4 test `rejects when store closed`).
2. **Store open but lineup empty** → shop/product routes show the coming-soon panel, never an empty grid or crash (Task 9 test `shows coming soon when lineup empty`).
3. **Variant with no `stripe_price_id`** (lineup loaded but not synced) → not purchasable: excluded by `purchasableVariants`, Add to cart disabled, checkout rejects (Task 1 + Task 10 tests).
4. **Cart in localStorage holds a variant that was removed in a later lineup** → stale lines dropped on load with a gentle notice; checkout never 400s the whole cart for it (Task 10 test `drops stale cart lines`).
5. **Refresh or deep link to `/products/does-not-exist`** → friendly not-found page with links to Tea and Coffee (Task 10 test `unknown slug shows not found`).

---

### Task 1: Shared catalog module and empty lineup

**Files:**
- Create: `lib/catalog.js`, `lib/catalog.test.js`, `src/data/lineup.json`, `lib/store-config.js`
- Modify: `vite.config.js` (vitest `include` covers `lib/**/*.test.js`, `scripts/**/*.test.js`, `api/**/*.test.js`, `src/**/*.test.jsx`)

**Interfaces:**
- Produces:
  - `lineup.json` shape: `{ "products": Product[] }`, initially `{ "products": [] }`.
  - `Product`: `{ slug, name, category, tea_type?, short_description, story?, flavor_notes: string[], caffeine: 'none'|'low'|'medium'|'high', ingredients?, origin?, brew_guide?: { water_temp, amount, steep_time }, tags: string[], featured: boolean, images: string[], tax_code?, subscribable?, variants: Variant[] }`
  - `Variant`: `{ id, format, size_label, cups?, price_cents, stripe_price_id? }`, where `id` is unique within the product (e.g. `loose-leaf-2oz`).
  - `validateLineup(data) -> { ok: boolean, errors: string[] }`: plain-English errors, e.g. `"Jasmine Dream: price for 'loose-leaf-2oz' must be more than $0"`.
  - `getProducts(category?) -> Product[]`, `getProduct(slug) -> Product | undefined`
  - `purchasableVariants(product) -> Variant[]`: only variants that have `stripe_price_id`
  - `findVariant(slug, variantId) -> { product, variant } | undefined`
  - `fromPriceCents(product) -> number`: lowest price among purchasable variants
  - `lib/store-config.js`: `isStoreOpen()` reads `import.meta.env?.VITE_STORE_OPEN` in the browser or `process.env.STORE_OPEN` in Node, true only for the string `'true'`. Also exports `FREE_SHIPPING_CENTS`, `FLAT_SHIPPING_CENTS`, `MAX_QTY = 20`, `CONTACT_EMAIL` (placeholder `hello@siphaven.com`, pending Joseph), `DEFAULT_TAX_CODE`.

- [ ] **Step 1: Write failing tests** in `lib/catalog.test.js` using an inline fixture (one tea with 2 variants, one variant missing `stripe_price_id`; one coffee):
  - `validateLineup` passes the fixture; fails on a duplicate slug, a duplicate variant id, a category of `'gear'`, a tea format of `'whole-bean'`, `price_cents: 0`, and a missing `name`. Each failure message names the product.
  - `purchasableVariants(tea)` has length 1.
  - `fromPriceCents(tea)` equals that variant's price.
  - `findVariant('nope', 'x')` is `undefined`.
  - The real `src/data/lineup.json` validates and `getProducts()` is `[]`.
- [ ] **Step 2:** Run `npx vitest run lib/catalog.test.js`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement `lib/catalog.js` and `lib/store-config.js`. The catalog functions take an optional data argument that defaults to the imported `lineup.json`, so tests can pass fixtures. For `DEFAULT_TAX_CODE`, look up the current Stripe tax code for food/grocery items in the Stripe Tax docs and add a comment citing the doc URL.
- [ ] **Step 4:** Run `npm test`. Expected: new tests PASS. The old checkout tests still pass, since they are untouched.
- [ ] **Step 5:** Commit `feat: add shared catalog module and empty lineup`.

### Task 2: Lineup CSV template and converter

**Files:**
- Create: `lineup-template.csv`, `scripts/csv-to-lineup.js`, `scripts/csv-to-lineup.test.js`
- Modify: `package.json` (add `csv-parse`; script `"lineup:csv": "node scripts/csv-to-lineup.js"`)

**Interfaces:**
- Consumes: `validateLineup` (Task 1).
- Produces: `csvToLineup(csvText: string) -> { products: Product[] }`. CLI: `node scripts/csv-to-lineup.js <file.csv>` writes `src/data/lineup.json` only if validation passes, otherwise prints the errors and exits 1.
- CSV format: **one row per variant**. Columns: `slug,name,category,tea_type,short_description,story,flavor_notes,caffeine,ingredients,origin,water_temp,amount,steep_time,tags,featured,images,format,size_label,cups,price`. Product-level columns are read from the first row of each slug. List columns (`flavor_notes`, `tags`, `images`) are separated by `|`. `price` is in dollars (`12.50`). Variant `id` = `${format}-${slugify(size_label)}`. Existing `stripe_price_id`s in the current `lineup.json` are kept when slug and variant id match.

- [ ] **Step 1: Write failing tests:**
  - Two rows with the same slug produce 1 product with 2 variants.
  - `"12.50"` becomes `1250`.
  - `"floral|honey"` becomes `['floral','honey']`.
  - `featured` accepts `yes`/`true`/`1`.
  - Existing price ids are preserved.
  - A blank `name` on the first row produces a validation error.
- [ ] **Step 2:** Run the test. Expected: FAIL.
- [ ] **Step 3:** Implement with `csv-parse/sync` (`columns: true, trim: true, skip_empty_lines: true`). `lineup-template.csv` holds the header plus 3 clearly fake example rows (slug `example-green-tea`, two formats; `example-house-coffee`, one format) that Joseph replaces.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: add lineup CSV template and converter`.

### Task 3: Stripe sync script (`load-lineup`)

**Files:**
- Create: `scripts/load-lineup.js`, `scripts/load-lineup.test.js`
- Modify: `package.json` (script `"load-lineup": "node --env-file=.env.local scripts/load-lineup.js"`)

**Interfaces:**
- Consumes: `validateLineup`, `DEFAULT_TAX_CODE`.
- Produces: `syncLineup(lineup, stripe, { live }) -> { lineup, report: string[] }`. It is pure aside from the injected `stripe` client.
  - Each product maps to a Stripe Product, found by `metadata.slug` via `stripe.products.search` or created. The name, description, first image (absolute URL only) and `tax_code` (product's or default) are updated.
  - Each variant maps to a Stripe Price. If `stripe_price_id` exists and that price's `unit_amount` equals `price_cents`, it is kept. Otherwise a new price is created (`currency: 'usd'`, `metadata: { slug, variant_id }`), the old one is set to `active: false`, and the new id is written back.
  - The CLI refuses to run if the key starts with `sk_live_` and `--live` is absent. It writes `src/data/lineup.json` and prints the report.

- [ ] **Step 1: Write failing tests** with a fake stripe object (`vi.fn()` methods):
  - A new product creates 1 product and N prices, and every variant gets an id.
  - An unchanged price creates no new price.
  - A changed price creates a new price and deactivates the old one.
  - `live: false` with an `sk_live_` key throws `Refusing to use a live Stripe key without --live`.
  - An invalid lineup throws before any Stripe call.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: add load-lineup Stripe sync script`.

### Task 4: Checkout API rewrite

**Files:**
- Modify: `api/checkout.js` (full rewrite), `api/checkout.test.js` (replace the old price-id tests)

**Interfaces:**
- Consumes: `findVariant`, `isStoreOpen`, `FREE_SHIPPING_CENTS`, `FLAT_SHIPPING_CENTS`, `MAX_QTY`.
- Produces:
  - Request body `{ items: [{ slug, variantId, qty }] }`. Response `{ url }` or `{ error }`.
  - `buildLineItems(items) -> { line_items, subtotal_cents }`. Throws `CheckoutError(message)` for an unknown or unpurchasable variant (`"That item is no longer available."`) and for a bad qty (`"Quantity must be between 1 and 20."`).
  - `shippingOptions(subtotal_cents) -> Stripe shipping_options[]`: free (`Free shipping`, 0) when the subtotal is at or above `FREE_SHIPPING_CENTS`, otherwise `Standard shipping` at `FLAT_SHIPPING_CENTS`.
  - Session params: `mode: 'payment'`, `automatic_tax: { enabled: true }`, `allow_promotion_codes: true`, `shipping_address_collection: { allowed_countries: ['US'] }`, `shipping_options`, `success_url: ${origin}/success?session_id={CHECKOUT_SESSION_ID}`, `cancel_url: ${origin}/cart`.

- [ ] **Step 1: Write failing tests** (mock `stripe` with `vi.mock`; set `STORE_OPEN` per test; use a fixture lineup through the optional data argument or `vi.mock('../src/data/lineup.json')`):
  - `rejects when store closed`: expects 403 and `{ error: 'Store is not open yet.' }`.
  - Valid items map to line items with the right `price`, and `subtotal_cents` is correct.
  - qty `0`, `21`, `1.5` and `'2'` are each rejected with a 400.
  - An unknown variant gives 400 with `"That item is no longer available."`.
  - `shippingOptions(4999)` is the flat rate; `shippingOptions(5000)` is free.
  - The session-create call includes `automatic_tax.enabled === true` and `allow_promotion_codes === true`.
  - A non-POST request gives 405.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: rewrite checkout for lineup variants, Stripe Tax, shipping, promo codes`.

### Task 5: Webhook hardening

**Files:**
- Modify: `api/webhook.js`, `api/webhook.test.js`

**Interfaces:**
- Consumes: the existing handler and signature check (keep as-is).
- Produces: the Resend `emails.send` call passes `{ idempotencyKey: event.id }` as its second argument, so a Stripe retry never sends a duplicate email. The order email lists line-item names and quantities (`stripe.checkout.sessions.listLineItems`) and the tax amount (`session.total_details.amount_tax`). The recipient comes from the `ORDER_NOTIFY_EMAIL` env var, falling back to the current hard-coded address.

- [ ] **Step 1: Add failing tests:**
  - `emails.send` is called with `idempotencyKey` equal to the event id.
  - The email body contains a line-item name and the tax amount.
  - Existing tests still pass.
- [ ] **Step 2:** Run the tests. Expected: new tests FAIL.
- [ ] **Step 3:** Implement. Add `ORDER_NOTIFY_EMAIL`, `RESEND_AUDIENCE_ID`, `STORE_OPEN`, `VITE_STORE_OPEN` and `STRIPE_WEBHOOK_SECRET` to `.env.example`.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit `fix: dedupe order emails and include items and tax`.

### Task 6: Email signup API

**Files:**
- Create: `api/subscribe.js`, `api/subscribe.test.js`

**Interfaces:**
- Produces: `POST /api/subscribe` with `{ email, interest?: 'tea'|'coffee'|'both' }`. Responses:
  - 200 `{ ok: true }`.
  - 400 `{ error: 'Please enter a valid email.' }`.
  - 500 `{ error: 'Something went wrong. Please try again.' }`.
  - Calls `resend.contacts.create({ email, audienceId: process.env.RESEND_AUDIENCE_ID, unsubscribed: false })`. An "already exists" response from Resend is treated as success. **It sends no email.**

- [ ] **Step 1: Write failing tests:**
  - A valid email calls `contacts.create` once.
  - `not-an-email`, an empty string and a 300-character string each give 400.
  - A Resend duplicate error gives 200.
  - A Resend failure gives 500.
  - Non-POST gives 405.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. Use a simple email regex and a max length of 254.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: add email signup endpoint (Resend Audience)`.

### Task 7: Frontend foundation (router, theme, layout)

**Files:**
- Create:
  - `src/router.jsx`
  - `src/components/Layout.jsx`, `ShippingStrip.jsx`, `Header.jsx`, `Footer.jsx`
  - `src/pages/NotFound.jsx`
  - `src/test/setup.js`
- Modify: `src/main.jsx`, `tailwind.config.js` (theme colors `cream`, `sage`, `sage-deep`, `wood`, `sage-tint`, `ink`; fonts `serif: Lora`, `sans: Nunito Sans`), `index.html` (Google Fonts link, meta description, Open Graph tags; keep title "Sip Haven"), `package.json` (add `react-router-dom`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`), `vite.config.js` (vitest `environmentMatchGlobs`: `src/**` uses jsdom)
- Delete: `src/App.jsx`, `src/App.css`, `public/icons.svg`, `src/assets/react.svg`, `src/assets/vite.svg`; `src/assets/hero.png` if unused

**Interfaces:**
- Produces:
  - Routes: `/`, `/tea`, `/coffee`, `/products/:slug`, `/quiz`, `/learn`, `/learn/:slug`, `/our-story`, `/contact`, `/shipping-returns`, `/privacy`, `/success`, `/cart` (opens the drawer over Home), and `*` (NotFound). Pages not built yet render a stub `<h1>` until their task.
  - `Layout` renders `ShippingStrip` ("Free shipping on orders over $50", computed from `FREE_SHIPPING_CENTS`), `Header` (nav: Tea · Coffee · Quiz · Learn [only if guides exist] · Our Story · Cart button), `<Outlet/>` and `Footer` (links to every real page plus `SignupForm` once Task 8 lands). Every link resolves to a real route.

- [ ] **Step 1: Write failing tests** `src/components/Layout.test.jsx`:
  - The header shows Tea, Coffee, Quiz and Our Story links with the right `href`s.
  - The shipping strip text includes `$50`.
  - The unknown route `/zzz` renders NotFound.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. Header and footer use the Garden Teahouse palette. The logo is the serif wordmark "Sip Haven" in `sage-deep`.
- [ ] **Step 4:** Run `npm test && npm run build && npm run lint`. Expected: all pass.
- [ ] **Step 5:** Commit `feat: router, Garden Teahouse theme and layout; remove old single-file app`.

### Task 8: Home page, coming-soon panel, signup form

**Files:**
- Create: `src/pages/Home.jsx`, `src/components/ComingSoon.jsx`, `src/components/SignupForm.jsx`, `src/components/ProductCard.jsx`, `src/assets/placeholders/*.svg` (2–4 original botanical/cup illustrations in the palette), tests alongside

**Interfaces:**
- Consumes: `isStoreOpen`, `getProducts`, `fromPriceCents`, `/api/subscribe`.
- Produces:
  - `<SignupForm interest? />` posts to `/api/subscribe`, shows "You're on the list. We'll let you know the moment our first collection is ready." on success, and shows the API error text inline on failure. The button is disabled while sending.
  - `<ComingSoon />` shows the heading "Our first collection is brewing", a short line and `<SignupForm/>`.
  - `<ProductCard product />` shows the image (placeholder if `images` is empty), name, up to 3 flavor notes and "from $X". It renders only when the store is open.
  - Home sections in order: welcome hero ("A little haven in every cup.", two path cards linking to `/tea` and `/coffee` with format subtitles) · featured products (only if the store is open and some are featured) or `<ComingSoon/>` · quiz teaser → `/quiz` · short story teaser → `/our-story` · guides teaser (only if guides exist) · footer signup.

- [ ] **Step 1: Write failing tests:**
  - Home with the store closed shows "Our first collection is brewing" and no element containing `$`.
  - The two path links point to `/tea` and `/coffee`.
  - SignupForm success shows the confirmation (mock `fetch`).
  - SignupForm failure shows `Please enter a valid email.`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test && npm run build`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: home page with coming-soon mode and working email signup`.

### Task 9: Shop pages with filters

**Files:**
- Create: `src/pages/Shop.jsx` (one component used for both `/tea` and `/coffee` via a `category` prop), `src/components/Filters.jsx`, `lib/filter.js`, `lib/filter.test.js`, `src/pages/Shop.test.jsx`

**Interfaces:**
- Consumes: `getProducts(category)`, `ProductCard`, `ComingSoon`.
- Produces: `filterProducts(products, { flavors: string[], caffeine: string[], formats: string[] }) -> Product[]`. Values within a group use OR; groups combine with AND; empty groups are ignored. Filter options are derived from the products shown, not hard-coded. Filter state lives in URL query params (`?caffeine=low&format=k-cup`) so it is shareable.

- [ ] **Step 1: Write failing tests:**
  - `filterProducts` handles OR within a group and AND across groups, and returns everything when filters are empty.
  - Shop: `shows coming soon when lineup empty` (store open and empty lineup → ComingSoon).
  - Shop with the store closed → ComingSoon.
  - Shop with the store open and a fixture → only tea products on `/tea`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. When filters exclude everything: "Nothing matches those filters yet." plus a Clear filters button.
- [ ] **Step 4:** Run `npm test && npm run build`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: tea and coffee shop pages with filters`.

### Task 10: Product page, cart and checkout

**Files:**
- Create: `src/pages/Product.jsx`, `src/components/VariantPicker.jsx`, `src/cart/CartContext.jsx`, `src/components/CartDrawer.jsx`, `src/components/FreeShippingProgress.jsx`, tests alongside

**Interfaces:**
- Consumes: `getProduct`, `purchasableVariants`, `findVariant`, `FREE_SHIPPING_CENTS`, `MAX_QTY`, `/api/checkout` (Task 4 body shape).
- Produces:
  - `useCart() -> { lines: [{ slug, variantId, qty }], add(slug, variantId, qty=1), setQty(slug, variantId, qty), remove(slug, variantId), subtotalCents, open(), close(), isOpen, notice }`. Persisted to `localStorage` key `siphaven-cart-v2` (wrapped in try/catch). On load, lines whose `findVariant` is undefined or unpurchasable are dropped, and `notice` is set to "Some items in your cart are no longer available and were removed."
  - Product page sections in order: gallery · name · `VariantPicker` (choose format, then size; shows `cups` as "about N cups") · price · Add to cart (disabled with "Not available yet" if no purchasable variant) · flavor notes · caffeine · brew guide · ingredients · "You might also like" (same category, shared tags, max 3).
  - The store-closed or unknown-slug cases render ComingSoon or NotFound respectively.
  - CartDrawer: lines, qty steppers capped at `MAX_QTY`, subtotal, `FreeShippingProgress` ("$X away from free shipping" / "You've earned free shipping"), "Taxes calculated at checkout", and a Checkout button that POSTs, redirects to `url`, and shows the `error` text inline on failure.

- [ ] **Step 1: Write failing tests:**
  - The variant picker sends the chosen `variantId` to `add` (regression for the old dropped-grind bug).
  - `drops stale cart lines`: seeded localStorage holds an unknown variant → line removed and notice shown.
  - `unknown slug shows not found`.
  - The progress text at a subtotal of 4000 reads "$10.00 away from free shipping".
  - A checkout failure shows "That item is no longer available." inline.
  - With the store closed, `/products/x` shows ComingSoon and no Add to cart.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test && npm run build`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: product page, variant picker, cart drawer and checkout`.

### Task 11: Quiz

**Files:**
- Create: `src/pages/Quiz.jsx`, `lib/quiz.js`, `lib/quiz.test.js`

**Interfaces:**
- Consumes: `getProducts`, `purchasableVariants`.
- Produces:
  - `QUIZ_QUESTIONS`: 4 questions with 3–4 answers each. Each answer maps to tags or attributes: drink preference (tea/coffee/either → category), caffeine (`none`/`low`/`medium`/`high`), flavor family (floral, fruity, earthy, sweet/spiced → tags), and brewing style (quick → `k-cup`/`tea-bags`/`ground`, ritual → `loose-leaf`/`whole-bean`).
  - `recommend(answers, products) -> Product[]`: up to 3 products, purchasable only, scored by matches (category is a hard filter unless "either").
  - When the store is closed or there are no matches, the result shows a friendly "We're still blending your perfect match" line with `<SignupForm interest={category}/>`.

- [ ] **Step 1: Write failing tests:**
  - "tea + none + floral + ritual" ranks a loose-leaf floral herbal tea first.
  - Unpurchasable products are never returned.
  - An empty product list returns `[]`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. Show one question at a time, with a back button and a progress dots indicator.
- [ ] **Step 4:** Run `npm test && npm run build`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: find-your-cup quiz driven by lineup tags`.

### Task 12: Content pages, Learn and success

**Files:**
- Create: `src/pages/OurStory.jsx`, `Contact.jsx`, `ShippingReturns.jsx`, `Privacy.jsx`, `Learn.jsx`, `Guide.jsx`, `Success.jsx`, `src/data/guides.js` (exports `GUIDES = []`)

**Interfaces:**
- Consumes: `CONTACT_EMAIL`, `FREE_SHIPPING_CENTS`, `FLAT_SHIPPING_CENTS`, `useCart().remove` (to clear the cart).
- Produces:
  - Pages with original, warm draft copy. Each draft page carries a top comment `{/* DRAFT COPY: needs Joseph's approval */}`.
  - Our Story: a short welcome about Sip Haven as a place to slow down, with no invented facts (no farms, years or awards).
  - Contact: a `mailto:` link to `CONTACT_EMAIL`, with no form.
  - Shipping & Returns: states the shipping values from config. It makes no return promise beyond "Contact us if anything arrives damaged and we'll make it right." (the old "30-day return" claim is removed).
  - Privacy: covers the email signup and Stripe checkout data.
  - Learn: lists `GUIDES`. The header link shows only when `GUIDES.length > 0`. `/learn` with no guides shows ComingSoon-style copy.
  - Success: thanks the customer, says the receipt comes from Stripe, and clears the cart.

- [ ] **Step 1: Write failing tests:**
  - Each content route renders an `h1`.
  - The Success page clears the cart.
  - The Learn link is absent when `GUIDES` is empty.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test && npm run build`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: story, contact, shipping, privacy, learn and success pages`.

### Task 13: Cleanup sweep and final verification

**Files:**
- Modify: anything still referencing removed content

- [ ] **Step 1:** Run `grep -rniE "shopify|12,400|87\+|seven farms|unsplash|whisper|murmur|30-day" src lib api index.html`. Expected: no matches, apart from the docs and the tests that assert absence.
- [ ] **Step 2:** Add a test `src/claims.test.js` that reads the built page sources and asserts none of those strings appear in `src/**`.
- [ ] **Step 3:** Run `npm test && npm run lint && npm run build`. Expected: all pass. Then run `npm run preview` and check in a browser at 375px and desktop widths: no horizontal scroll; every nav and footer link lands on a real page; with the store closed, no `$` or Add to cart is visible on `/`, `/tea`, `/coffee` or `/quiz` results.
- [ ] **Step 4:** Smoke-test the open-store path locally only: `STORE_OPEN=true VITE_STORE_OPEN=true`, a 2-product fixture lineup synced with `npm run load-lineup` (test key), a Stripe test checkout with card `4242 4242 4242 4242`, and confirm the success page shows. Then revert `lineup.json` to `{ "products": [] }`.
- [ ] **Step 5:** Commit `chore: cleanup sweep and verification`, then push the branch. **Do not merge or deploy to production**; Joseph decides.

---

## Joseph's to-do (outside the code)

- Stripe dashboard: turn on Stripe Tax, enter the business address and sales-tax registrations.
- Resend: create an Audience and put its id in Vercel as `RESEND_AUDIENCE_ID`. Verify the siphaven.com sending domain if it isn't verified yet.
- Decide the free-shipping threshold, the shipping rate and the public contact email.
- Fill in `lineup-template.csv` and send it, along with photos.
- To give a select few a discount: create a promotion code in Stripe (or ask Claude to) and share it.
