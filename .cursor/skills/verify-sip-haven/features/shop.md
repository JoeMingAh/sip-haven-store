# Shop

Tea and coffee each have a page. While the store is closed, or the lineup has nothing in that category, the page is a title plus the coming-soon panel. With a real lineup and an open store, the same page is a filter column and a product grid.

## Sub-features

- `shop-tea` opens the tea page from the header, the home path card, or `/tea`.
- `shop-coffee` opens the coffee page the same way.
- `shop-coming-soon` shows `Our first collection is brewing` and an email field, with no prices and no filters.
- `shop-filters` narrows the grid by flavor, caffeine, and format. The committed lineup cannot do that.
- `shop-product` would open a product from a card. Every `/products/<slug>` is the coming-soon page while the store is closed.

## How to get to it (user POV)

- Choose `Tea` or `Coffee` in the header.
- On the home page, choose `I'm a tea person Loose leaf, tea bags and K-Cups` or `I'm a coffee person Whole bean and ground`.
- Open `/tea` or `/coffee` directly.

## Driving it with the Sip Haven harness

Preconditions:

- `doctor.sh` prints `store=closed`.
- `src/data/lineup.json` still has an empty `products` array. If it does not, stop and follow the filter steps instead of the coming-soon steps.

- **Tea from the header.** Run `node .cursor/skills/verify-sip-haven/harness.mjs goto /` and `node .cursor/skills/verify-sip-haven/harness.mjs click --role link --name "Tea" --exact --within-role navigation --within-name "Main" --wait-heading "Tea"`. The address is `/tea`. The h1 is `Tea`.
- **Coming soon.** Run `node .cursor/skills/verify-sip-haven/harness.mjs expect --role region --name "Our first collection is brewing" --exact`, `node .cursor/skills/verify-sip-haven/harness.mjs expect --role heading --name "Filters" --exact --absent`, `node .cursor/skills/verify-sip-haven/harness.mjs expect-main --absent --text "$"`, `node .cursor/skills/verify-sip-haven/harness.mjs screenshot --path shop/tea.png --full-page`, and `node .cursor/skills/verify-sip-haven/harness.mjs snapshot --path shop/tea.aria.txt`. The picture shows the `Sip Haven` header, the `Tea` heading, and the coming-soon panel. Do not choose `Join the list` (the footer has a second one).
- **Coffee.** Run `node .cursor/skills/verify-sip-haven/harness.mjs click --role link --name "Coffee" --exact --within-role navigation --within-name "Main" --wait-heading "Coffee"` and `node .cursor/skills/verify-sip-haven/harness.mjs expect --role region --name "Our first collection is brewing" --exact`.
- **Filters.** Stop if the `Filters` heading is absent. Report the empty lineup and the closed store. Do not mark `shop-filters` passed because the coming-soon panel rendered. When a lineup is present and the store is open, the groups are `Flavor`, `Caffeine`, and `Format` (checkbox names are the lineup's flavor notes, `Caffeine-free` / `Low` / `Medium` / `High`, and `Loose leaf` / `Tea bags` / `K-Cup` / `Whole bean` / `Ground`). The address uses `flavor`, `caffeine`, and `format`. The status line reads `Showing N of M teas` (or coffees). `Clear filters` removes them. An empty match says `Nothing matches those filters yet.`
- **Product.** Open `/products/any-slug` only to confirm the closed store. The h1 is `Coming soon`, not a product name and not `We couldn't find that page`.

## Gotchas

- Header and footer both expose `Tea` and `Coffee`. Scope the header with `--within-role navigation --within-name Main`. An unscoped click finds two links and stops.
- The coming-soon email control is not a filter. Submitting it POSTs `/api/subscribe`, which this dev server does not run.
- A closed store never lists products, even if `lineup.json` is later filled in, until `STORE_OPEN` is exactly `true` at server start. This skill's launch leaves it unset on purpose.
- The `Filters` button exists only below the `md` breakpoint. This harness is `1280x800`, so an open store would show the filter panel without that button.
- Unknown product slugs are the not-found page only when the store is open and the lineup is non-empty.
