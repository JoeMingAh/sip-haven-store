# Sip Haven verification map

This directory is the maintained source for shopper-facing checks of the Sip Haven storefront. Read it before driving the app, then follow one feature file.

## Baseline preconditions

- Launch with `.cursor/skills/verify-sip-haven/launch.sh` from the repo root.
- `doctor.sh` prints `ok`, `store=closed`, and `auth=none`.
- The run uses the committed `src/data/lineup.json` (`products` is empty) and a new Chrome profile. There is no seed cart.
- Do not export `STORE_OPEN` or `VITE_STORE_OPEN`. Do not load `.env.local`.
- Drive only the instance this launch started. If two runs are up, set `SIP_HAVEN_VERIFY_RUN`.

## Driving conventions

- Start from the home page unless the feature names another entry.
- The harness viewport is `1280x800`. Prefer roles and accessible names.
- Pass `--exact` when the command quotes a full accessible name.
- Question headings are matched by the prompt substring (`--wait-heading`), because the accessible name is `Question N of 6` plus the prompt.
- `click` fails when the name matches more than one element. That is intentional.
- Do not remove `/tmp/sip-haven-verify/evidence/<run-id>/` during cleanup.

## Proof and skip reporting

- Capture the action and the resulting state. `commands.log` and `actions.log` are written for you; also take a screenshot and an ARIA snapshot at the moment the feature names.
- A closed-store page proves itself with the heading the shopper sees. A missing `Filters` heading is not a passed filter check.
- The quiz-note POST returning `404` proves the browser sent it and that this dev server did not store it.
- When a precondition is missing, stop and report that failure. The reason is in the feature's Gotchas. Do not change the lineup, open the store, or call Stripe or Resend to force a pass.

## Features

- [Find your cup](./quiz.md) is the six-question quiz and the still-blending result on a closed store.
- [Shop](./shop.md) is the tea and coffee pages, which show the coming-soon panel while the lineup is empty.
- [Cart](./cart.md) is the cart drawer, empty while the store is closed.
- [Home](./home.md) is the landing page: the two paths, the coming-soon panel, and the links into the quiz and the story.
- [Our story](./our-story.md) is the story page and its questions.
