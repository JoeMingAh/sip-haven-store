# Home

The home page is the shopper's front door: a heading, a tea path, a coffee path, and, while nothing is for sale, a coming-soon signup. Below that are the quiz and the story. Brewing guides are omitted while there are no guides.

## Sub-features

- `home-hero` shows `A little haven in every cup.` and the two path cards.
- `home-coming-soon` shows `Our first collection is brewing` instead of an `Our picks` grid.
- `home-quiz` links to the quiz with `Take the quiz`.
- `home-story` links to the story with `Read our story`.
- `home-guides` would link to `/learn`. It is absent while `GUIDES` is empty.

## How to get to it (user POV)

- Open `/`.
- Choose the `Sip Haven` wordmark in the header.
- Leave Stripe Checkout for `/cart`, which renders this page under the cart drawer. The drawer itself is covered by the cart feature.

## Driving it with the Sip Haven harness

Preconditions:

- `doctor.sh` prints `store=closed`.
- `src/data/guides.js` exports an empty `GUIDES` list. If it does not, the guides region is present and `home-guides` is reachable; do not claim it is absent.

- **Land.** Run `node .cursor/skills/verify-sip-haven/harness.mjs goto /`. The h1 is `A little haven in every cup.` The document title settles on `Sip Haven | Tea and coffee for slow mornings`.
- **Paths.** Run `node .cursor/skills/verify-sip-haven/harness.mjs expect --role link --name "I'm a tea person Loose leaf, tea bags and K-Cups" --exact` and `node .cursor/skills/verify-sip-haven/harness.mjs expect --role link --name "I'm a coffee person Whole bean and ground" --exact`.
- **Coming soon.** Run `node .cursor/skills/verify-sip-haven/harness.mjs expect --role region --name "Our first collection is brewing" --exact` and `node .cursor/skills/verify-sip-haven/harness.mjs expect --role heading --name "Our picks" --exact --absent`.
- **Next steps.** Run `node .cursor/skills/verify-sip-haven/harness.mjs expect --role link --name "Take the quiz" --exact` and `node .cursor/skills/verify-sip-haven/harness.mjs expect --role link --name "Read our story" --exact`.
- **No guides teaser.** Run `node .cursor/skills/verify-sip-haven/harness.mjs expect --role heading --name "Brewing guides" --exact --absent`.
- **Proof.** Run `node .cursor/skills/verify-sip-haven/harness.mjs screenshot --path home/landing.png --full-page` and `node .cursor/skills/verify-sip-haven/harness.mjs snapshot --path home/landing.aria.txt`. The snapshot shows the h1, both path links, the coming-soon region, `Take the quiz`, and `Read our story`.
- **Leave.** Choose `Take the quiz` only when you mean to start the quiz feature. The click is `node .cursor/skills/verify-sip-haven/harness.mjs click --role link --name "Take the quiz" --exact --wait-heading "Tea or coffee today?"`.

## Gotchas

- The coming-soon panel and the footer each render `Join the list` and `Email address`. Do not click the button.
- The shipping strip above the header says `Free shipping on orders of $50 or more`. It is outside `main`. A check that main has no `$` can still pass on this page.
- `Our picks` is the featured-product grid. It is absent because the store is closed and the lineup is empty. Do not describe the coming-soon panel as that grid.
- The guides teaser is omitted entirely when `GUIDES` is empty. `/learn` still exists; the home page just does not link to it. The header does not link to it either.
- Path-card names include the format line. `I'm a tea person` without the formats is only a substring.
