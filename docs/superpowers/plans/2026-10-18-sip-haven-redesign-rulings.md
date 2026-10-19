# Sip Haven redesign: build rulings

Decisions made during the build, in order. Each lists what it costs if it's wrong. Joseph: please skim these.

- Ruling R1: isStoreOpen() returns true if (typeof process!=='undefined' && process.env?.STORE_OPEN==='true') OR import.meta.env?.VITE_STORE_OPEN==='true'; UI tests toggle via vi.mock('lib/store-config') or vi.stubEnv — keeps one function for both runtimes — cost if wrong: small refactor.
- Ruling R2: Task 8 adds SignupForm into Footer — plan text says footer gets it once T8 lands — cost: none.
- Ruling R3: Task 7 creates src/data/guides.js exporting GUIDES = []; Task 12 consumes it — header needs it in T7 — cost: none.
- Ruling R4: Task 10 adds clear() to useCart; Task 12 Success calls clear() — remove(slug,variantId) can't clear all cleanly — cost: none.
- Ruling R5: Task 13 claims test scans source files under src/ and lib/ (fs read, excluding *.test.*) not built dist — dist is gitignored/absent in tests — cost: none.
- Ruling R6: fromPriceCents returns null when nothing purchasable (brief said number) — null is the honest value; UI must hide price on null — cost: tiny.
- Ruling R7: Task 4 adds vercel.json functions includeFiles for src/data/lineup.json to be safe for Vercel bundling — cost: harmless config.
- Ruling R8: Task 7 adds 'src/**/*.test.js' to vitest include — T13's src/claims.test.js would otherwise be silently skipped — cost: none.
- Ruling R9: Task 3 updates eslint.config.js to give scripts/, api/, lib/ Node globals (process etc.) — scripts need process; fixing config beats per-file imports — cost: none.
- Ruling R10: Task 3 load-lineup refuses to sync any product whose slug starts with `example-` (template rows left in by mistake) — prevents fake products going to Stripe — cost: none.
- Ruling R11: load-lineup creates prices with tax_behavior 'exclusive' (US norm: tax added at checkout) and treats an existing price with a different tax_behavior as changed — Stripe automatic_tax needs it — cost if wrong: prices recreated as inclusive later.
- Ruling R12: syncLineup option { apiKey } accepted for the live-key check (stripe client can't report its key) — cost: none.
- Ruling R13: Task 5 order email lists each line as "<product name> (<price.metadata.variant_id>) × qty", via listLineItems with expand ['data.price'] — the variant isn't in the line description — cost: none.
- Ruling R14: Vercel bundling of lineup.json (R7) is verified at the first preview deploy, which needs Joseph to log in to Vercel — no CLI/MCP access now — cost: a fix if the preview fails.
- Ruling R15: webhook reads the shipping address from session.collected_information?.shipping_details, falling back to session.shipping_details; .env.example also lists RESEND_API_KEY and STRIPE_SECRET_KEY placeholders — Stripe v22 moved the field; order emails otherwise lose the address — cost: none.
- Ruling R16: accept Task 5 deviations (listLineItems limit 100; Resend {error} → 500 so Stripe retries; legacy "name xN" when no variant_id) — all strictly safer — cost: none.
- Ruling R17: signup accepts and drops `interest` for now (Resend needs the property created in the account first); duplicate detected by HTTP 409 or /already exist/i — avoids a guess that could 500 every signup — cost if wrong: interest data not captured until enabled.
- Ruling R18: palette hexes stay verbatim; for WCAG AA all filled buttons/strips use bg-sage-deep text-cream, and plain sage is for accents, borders and tints only — spec says refine for contrast; keeps the chosen look — cost: slightly darker buttons than the mockup.
- Ruling R19: vitest uses test.projects (node for lib/scripts/api, jsdom for src/**) since environmentMatchGlobs doesn't exist in Vitest 4 — cost: none.
- Ruling R20: branch must not be merged/deployed before Task 10 (no checkout UI in between) — cost: none.
- Ruling R21: store open + lineup non-empty + nothing featured → Home shows neither featured section nor ComingSoon — an open store shouldn't say "brewing" — cost: empty-ish home until something is featured (load-lineup/CSV sets featured).
- Ruling R22: pages that render only ComingSoon (Shop, Product, Learn) supply their own h1 (ComingSoon is h2) — Layout test requires an h1 per route — cost: none.
- Ruling R23: Task 10 changes SignupForm success text when isStoreOpen() is true to "You're on the list. We'll keep you posted on new teas and coffees." — brief's wording reads stale after launch — cost: none.
- Ruling R24: Shop "lineup empty" = no products in that category → ComingSoon; filters use repeated URL params — reasonable reading of brief — cost: none.
- Ruling R25: shipping strip "$50" may show while closed — it is an offer, not a product price; "no prices" means product prices — cost: Joseph may want strip hidden pre-launch (one-line).
- Ruling R26: /cart = Home with drawer open; Product page with open store + empty lineup shows ComingSoon — matches review focus 2 — cost: none.
- Ruling R27: product `story`/`origin`/`tea_type` rendering deferred to Task 13 cleanup (render story + origin under description) — fields exist in spec data model — cost: small.
- Ruling R28: Task 13 adds a note row/comment to lineup-template.csv listing the quiz flavor tags (floral, fruity, earthy, sweet, spiced) so Joseph's tags drive the quiz — cost: none.
- Ruling R29: Task 13 changes shipping strip to "Free shipping on orders of $50 or more" so it matches checkout's >= threshold and the Shipping page — cost: none.
- Ruling R30: Success page keeps "receipt comes from Stripe"; Joseph must turn on Stripe customer email receipts (added to his to-do) — cost: none.
- Ruling R31: Task 13 step 4 (real Stripe test-mode sync + card checkout) is NOT run by agents — hosted Stripe checkout is off-localhost and creates objects in Joseph's account; replaced by the existing contract tests; the real e2e is listed for Joseph with a preview deploy — cost: first real end-to-end check happens later with Joseph.
- Ruling R32: claims scan covering api/ too is accepted (superset of R5, safer) — cost: none.
