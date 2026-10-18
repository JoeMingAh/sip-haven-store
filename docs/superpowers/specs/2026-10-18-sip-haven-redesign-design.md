# Sip Haven Redesign: Tea + Coffee, Lineup-Ready

Date: 2026-10-18 · Status: draft for Joseph's approval

## Intent

Rebuild siphaven.com as a clean, warm, welcoming shop for **both tea and coffee**. Joseph's words: "clean and warm… a warm welcoming." The store-structure patterns are studied from artoftea.com (a reference, not a source): homepage flow, shop-by filters, one-scroll product pages, quiz, learn hub, free-shipping progress. **No Art of Tea text, images, logos, or product names are copied.** All copy, branding and imagery are Sip Haven's own.

Joseph has **no product lineup yet**. The site must be fully built and ready so that when he hands over a lineup, it is loaded from data (no code changes) and the shop switches on.

## Goals

1. Garden Teahouse look across the whole site (chosen from 3 mockups).
2. Product catalog driven by one data file that Joseph can fill like a spreadsheet.
3. "Coming soon" mode now: no product can be bought; shop sections invite email signup instead.
4. One-command "load lineup" step: read the lineup file, create matching Stripe products/prices, switch the shop on.
5. Every visible button and link works. No dead ends.
6. Remove unsourced claims and stale Shopify copy.

## Non-goals (for now)

- Subscriptions (wanted later; the data model and product page leave room for a "subscribe" option but nothing is built). Current mode is one-time buy only.
- Rewards/loyalty program, wholesale portal, gift cards, customer accounts, reviews system.
- Real product photography (Joseph supplies later; placeholders until then).

## Anti-goals (failure even if it "works")

- Looks or reads like a clone of Art of Tea.
- Any "Add to cart" on something that can't be bought.
- Invented numbers or claims (ratings, review counts, farm counts, awards, press logos) presented as real.
- Joseph needing to touch code to add or edit a tea. Per Joseph ("when I give it to you, you can upload it"): he hands Claude a filled-in sheet, and Claude runs the load-lineup step, commits, and redeploys with his yes. So a build-time `lineup.json` in the repo is correct; no admin page or runtime catalog is needed.

## Constraints

- Build on the existing repo: `Playground/sip-haven-store` — Vite + React 19, Tailwind 3, Vercel serverless `api/`, Stripe Checkout (hosted), Resend order email via `api/webhook.js`. Keep checkout + webhook behavior; existing tests in `api/*.test.js` must keep passing (update where behavior intentionally changes).
- Deploy to the live site only with Joseph's explicit yes. Stripe stays in test keys until he says otherwise.
- Never send email to customers, create live Stripe prices, or spend money without his yes.

## Visual direction: Garden Teahouse (Joseph's choice)

- Palette: warm cream background (~#F7F4EC), sage green primary (~#6F8466, darker ~#4E5F47 for text accents), natural wood/tan secondary (~#E9DCC8), soft sage tint (~#DDE5D3), deep green-charcoal text (~#2F3A2E). Exact values are the builder's to refine for contrast (WCAG AA).
- Serif headings (a warm webfont, actually loaded), clean sans body. Generous whitespace, rounded cards, calm botanical feel.
- Reference mockup: `.superpowers/brainstorm/*/content/visual-style.html`, option C.

## Site structure

Real routes (replace the current single `view` state with a router so URLs are shareable and refresh works; Vercel rewrite already sends all paths to the SPA).

| Route | Content |
|---|---|
| `/` | Shipping strip · nav · welcome hero with two paths ("I'm a tea person" / "I'm a coffee person") · featured products · quiz teaser · short Sip Haven story · latest guides · email signup · footer |
| `/tea`, `/coffee` | Shop grid with filters: flavor, caffeine, format. Card: photo, name, flavor notes, "from $X" |
| `/products/:slug` | One scroll: gallery · name · format + size picker (with cup counts) · price · Add to cart · flavor notes · caffeine · brew guide · ingredients · "you might also like" |
| `/quiz` | Short quiz → recommendations pulled from the lineup by tags |
| `/learn`, `/learn/:slug` | Brewing guides, written as content files (markdown or data). Start with 2–3 placeholder-free guides or hide the section until guides exist |
| `/our-story`, `/contact`, `/shipping-returns`, `/privacy` | Real pages; copy drafted by Claude, approved by Joseph |
| `/success` | Order confirmation after Stripe Checkout |
| Cart | Slide-out drawer with free-shipping progress bar |

Nav: Tea · Coffee · Quiz · Learn · Our Story · search (optional, builder's call) · Cart.

## Catalog data model

One file, e.g. `src/data/lineup.json` (or CSV converted to it). Joseph will fill a matching spreadsheet template (`lineup-template.csv`) delivered with the build.

Per product:
- `slug`, `name`, `category` (`tea` | `coffee`), `tea_type` (e.g. green, black, herbal; tea only), `short_description`, `story`
- `flavor_notes` (list), `caffeine` (none / low / medium / high), `ingredients`, `origin` (optional)
- `brew_guide` (water temp, amount, steep time; per format if different)
- `tags` (for filters + quiz), `featured` (bool)
- `images` (list of paths; placeholder if empty)
- `variants`: list of `{ format, size_label, cups, price_cents, stripe_price_id }`
  - Tea formats: `loose-leaf`, `tea-bags`, `k-cup`
  - Coffee formats: `whole-bean`, `ground` (grind options as variants if needed)
- Reserved for later: `subscribable` (ignored for now)

The variant chosen on the product page is what goes into the cart and checkout (fixes today's bug where grind choice was dropped).

## Coming-soon mode

- A single site setting, e.g. `STORE_OPEN=false` (env var or config file).
- While closed: shop and product routes show a "Our first collection is brewing" panel with the email signup; no prices or Add to cart anywhere; the cart and checkout API reject requests.
- The two current coffees (Whisper, Murmur) are taken off sale, per Joseph.
- When the lineup is loaded and Joseph says go, flip to open.

## Load-lineup step

A script (e.g. `npm run load-lineup`) that:
1. Validates the lineup file (required fields, prices > 0, unique slugs) and reports problems in plain language.
2. Creates or updates Stripe products/prices (test mode unless told otherwise) and writes `stripe_price_id` back to the file.
3. The checkout API reads allowed price IDs from the same file (removing today's duplicated hard-coded IDs in `src/App.jsx` and `api/checkout.js`).

## Email signup

Signups must actually be captured (today's buttons do nothing). Builder's call on storage; default is a Resend Audience via a new `api/subscribe.js`, since Resend is already used. Signup shows a friendly confirmation. No email is sent to subscribers without Joseph's approval of the content.

## Checkout hardening (while touching it)

- Validate `qty` (positive integer, sensible max).
- Show checkout errors to the shopper, not just the console.
- Free-shipping threshold and flat shipping rate configured in one place and applied in Stripe Checkout.
- Keep webhook order email to Joseph; add event dedupe.
- Sales tax: Joseph's call: "let Stripe or a payment system calculate that for us." Use Stripe Tax (`automatic_tax` in Checkout); load-lineup sets a tax code per product (tea/coffee as food/grocery codes). Joseph must enable Stripe Tax and enter his business address and registrations in the Stripe dashboard himself; Stripe charges a per-transaction fee.

## Cleanup

- Remove: "4.8 from 12,400+ makers", "87+" score, "seven farms", fake testimonial, Shopify copy, unused assets (`src/App.css`, `public/icons.svg`, `src/assets/*` if unused).
- Replace hot-linked Unsplash images with local placeholder art in the Garden Teahouse style (or properly licensed images stored in repo).
- Add meta description, social preview tags, keep favicon/title ("Sip Haven").
- Add `.superpowers/` to `.gitignore`.

## Left to the builder

Component structure, router choice, filter UX details, animation, placeholder art style, exact copy drafts (Joseph approves final copy), test approach for new code.

## Open items (Joseph to decide)

- Free-shipping threshold and shipping rate (placeholder $50 in mockups).
- Whether to offer a first-order discount for email signup (placeholder 10%) — it's a spend decision.
