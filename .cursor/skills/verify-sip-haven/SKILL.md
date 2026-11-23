---
name: verify-sip-haven
description: Drive the Sip Haven storefront, a React web shop, the way a shopper does. Use to launch the Vite dev server, walk a route such as the quiz, shop, cart, home, or our story, and capture screenshots and ARIA snapshots as proof.
---

# Verify Sip Haven

Sip Haven's primary surface is the web storefront (`src/`). A shopper uses the header, the home page, `/tea`, `/coffee`, `/quiz`, `/our-story`, and the cart drawer. This skill launches that UI and drives it in Chrome.

Other surfaces, not launched here:

- Vercel functions in `api/` (`/api/checkout`, `/api/subscribe`, `/api/quiz-notes`, `/api/webhook`). `npm run dev` does not serve them.
- Offline script `npm run lineup:csv`. `npm run load-lineup` and `npm run quiz-notes:summary` need the owner's Stripe or Blob secrets. Do not run those, and do not send email or open Stripe.

The committed shop is closed. `src/data/lineup.json` is `{ "products": [] }`. `src/data/guides.js` exports `GUIDES = []`, so the header has no Learn link. There is no database and no shopper login.

## Launch

From the repo root:

```bash
.cursor/skills/verify-sip-haven/launch.sh
```

This is `npm run dev` (`vite`) with `--host 127.0.0.1`, `--port`, and `--strictPort`. The default port is `5173`. Set `SIP_HAVEN_VERIFY_PORT` to run a second instance beside the first. Set `SIP_HAVEN_VERIFY_RUN` only when you need a specific run id.

The script refuses to start when `.env`, `.env.local`, `.env.development`, or `.env.development.local` exists. Vite would load those files and could open the store or read live Stripe, Resend, or Blob secrets. It also strips `STORE_OPEN`, `VITE_STORE_OPEN`, and those secrets from the server process. `.env.example` is not loaded.

If `node_modules/vite/bin/vite.js` is missing, the script runs `npm ci`. There is no data directory and no migration. A fresh run uses the committed empty lineup. The browser profile created later is empty, so `localStorage` key `siphaven-cart-v2` starts unset.

Ready means the shop document can be served and the entry module transforms, not merely that a port accepts a connection. `launch.sh` returns when `doctor.sh` prints `ok`. The server log also contains `Local: http://127.0.0.1:<port>/`.

Two runs can sit side by side on different ports. Each has its own Chrome profile under its state directory. They share the read-only lineup file. Do not point two runs at one state directory, and do not drive a Vite process this launch did not start.

Teardown is `cleanup.sh` in Cleanup.

## Doctor

```bash
.cursor/skills/verify-sip-haven/doctor.sh
```

Read-only. Run it before the first drive and again after anything surprising. It exits `0` only when all of these are true:

- The pid in this run's state is alive, its cwd is the repo, and its command is `vite/bin/vite.js`.
- That pid, or a child of it, owns the listen port. Another process on the port fails the check.
- The server log's `VITE v<version>` matches `node_modules/vite` in this checkout.
- `STORE_OPEN` and `VITE_STORE_OPEN` are not `true` on that process.
- `GET /` returns the Sip Haven document (`id="root"` and `Sip Haven`).
- `GET /src/main.jsx` returns the transformed entry (`createBrowserRouter`).

There is no shopper session to validate. A passing doctor prints `store=closed` and `auth=none`.

If more than one launch is alive, set `SIP_HAVEN_VERIFY_RUN` to the id `launch.sh` printed.

## Drive

The harness is Playwright driving the system Google Chrome, headless, viewport `1280x800`. The first command installs `playwright@1.65.1` into `/tmp/sip-haven-verify/tools` (not a project dependency) and starts Chrome. Later commands reuse that browser. Do not wait for `networkidle`; the Vite HMR socket stays open. `goto` waits for a level-1 heading.

```bash
node .cursor/skills/verify-sip-haven/harness.mjs goto /quiz
node .cursor/skills/verify-sip-haven/harness.mjs click --role button --name "Tea" --exact --wait-heading "How do you want to feel?"
node .cursor/skills/verify-sip-haven/harness.mjs expect --role heading --name "Find your cup"
node .cursor/skills/verify-sip-haven/harness.mjs expect --role button --name "Back" --exact --absent
node .cursor/skills/verify-sip-haven/harness.mjs expect-current --role button --name "Tea" --exact
node .cursor/skills/verify-sip-haven/harness.mjs expect-text --text "Your cart is empty." --exact
node .cursor/skills/verify-sip-haven/harness.mjs expect-main --absent --text "$"
node .cursor/skills/verify-sip-haven/harness.mjs screenshot --path quiz/result.png --full-page
node .cursor/skills/verify-sip-haven/harness.mjs snapshot --path quiz/result.aria.txt
node .cursor/skills/verify-sip-haven/harness.mjs expect-api --url /api/quiz-notes --method POST --status 404
node .cursor/skills/verify-sip-haven/harness.mjs api-log --path quiz/api-responses.jsonl
node .cursor/skills/verify-sip-haven/harness.mjs console-log --path quiz/console.log
node .cursor/skills/verify-sip-haven/harness.mjs session-stop
```

`--name` is the accessible name. Without `--exact` it is a case-insensitive substring, which is how `--wait-heading` matches a question whose name starts with `Question N of 6`. With `--exact`, one match is required for `click` and `expect-current`. `expect --absent` passes only when the count stays `0`. Header and footer share `Tea`, `Coffee`, and `Our Story`; scope the header with `--within-role navigation --within-name Main`.

Stable handles, from the running closed store:

- Header link `Sip Haven` (`/`). Main nav links `Tea`, `Coffee`, `Quiz`, `Our Story`. No Learn link while `GUIDES` is empty.
- Button `Cart` opens dialog `Your cart`. Close button `Close cart`.
- Home h1 `A little haven in every cup.` Links `I'm a tea person Loose leaf, tea bags and K-Cups` and `I'm a coffee person Whole bean and ground`. Region `Our first collection is brewing`. Link `Take the quiz`. Link `Read our story`.
- Quiz h1 `Find your cup`. Answer buttons use the full name, hint included: `Tea`, `Either one Show me both`, `Caffeine-free Nothing to keep me up`, `Floral Blossoms and soft fragrance`, `Surprise me No preference`, `A slow ritual Loose leaf, Whole bean`. On-page buttons `Back` and `Start over` appear after the first answer.
- Shop h1 `Tea` or `Coffee`, then the same coming-soon region. No `Filters` heading.
- Our story h1 `Our story`. FAQ headings are `What is Sip Haven?`, `What does Sip Haven sell?`, and `How do I pick a tea or coffee?`.

Routes the map does not cover, same harness: `/learn` (h1 `Brewing guides`, h2 `Guides are on the way`), `/contact` (h1 `Contact us`, mailto `hello@siphaven.com`, no form), `/shipping-returns` (h1 `Shipping and returns`), `/privacy` (h1 `Privacy`), unknown paths (h1 `We couldn't find that page`). `/success` (h1 `Thank you for your order`) is where Stripe would send a shopper; do not invent a payment to open it. `/products/<slug>` while the store is closed shows h1 `Coming soon` for every slug.

Recipes are in `features/`. Drive the real controls. Do not set cart state through `localStorage`, and do not call a test-only endpoint.

## Evidence

Proof goes to `/tmp/sip-haven-verify/evidence/<run-id>/`. Relative `--path` values are written there. `commands.log` records each harness command and its JSON result. `actions.log` records clicks. `cleanup.sh` does not delete this directory.

A proof shows the shopper action and the state it produced:

- Screenshot with the `Sip Haven` header visible, plus an ARIA snapshot of the same moment.
- For a kept answer, `expect-current` (`aria-current="true"`), not only the heading.
- For the quiz note, `expect-api` plus `api-responses.jsonl`. Under this launch the POST to `/api/quiz-notes` returns `404` with an empty body. That shows the request fired and that nothing was stored. A stored note would be a JSON response from `api/quiz-notes.js`. Do not aim the app at a production Blob store to turn the `404` into a `200`.
- Prices: `expect-main --absent --text "$"` on a closed-store page. The shipping strip outside `main` still says `$50`. The cart dialog is also outside `main`; use `expect-text` for `Your cart is empty.`

Do not submit `Join the list`. The footer and the coming-soon panel each have one, so a `click` sees two buttons and stops. A submit POSTs `/api/subscribe`. This launch does not run that function, and a wired `RESEND_API_KEY` would write a real audience. Do not click `Checkout`. It is not on the closed-store cart; on an open store it would send the shopper to Stripe.

There is no dry-run mode. The closed store is the real mode: it hides prices, skips recommendations, and still fires the quiz-note request.

## Cleanup

```bash
.cursor/skills/verify-sip-haven/cleanup.sh
```

Kills the harness pid (that process closes the Chrome it launched) and the vite pid, then deletes `/tmp/sip-haven-verify/state/<run-id>/`. It does not kill by process name and does not remove `/tmp/sip-haven-verify/evidence/<run-id>/` or the Playwright install under `/tmp/sip-haven-verify/tools`.

Set `SIP_HAVEN_VERIFY_RUN` when more than one state directory exists. Run cleanup after a failed launch too, so a dead pid and a busy port are not left behind. `launch.sh` kills the vite process it started if doctor never passes, and leaves the state directory for this script.

## Helpers

All of these live in `.cursor/skills/verify-sip-haven/` and are verification-only. They are not part of the shop.

| Script | Invocation |
| --- | --- |
| `launch.sh` | `.cursor/skills/verify-sip-haven/launch.sh` |
| `doctor.sh` | `.cursor/skills/verify-sip-haven/doctor.sh` |
| `cleanup.sh` | `.cursor/skills/verify-sip-haven/cleanup.sh` |
| `harness.mjs` | `node .cursor/skills/verify-sip-haven/harness.mjs <command>` |
| `common.sh` | Sourced by the three shell scripts. Do not run it directly. |

Keep this map honest with `/maintain-verification-skill` when the shop's routes or labels change.
