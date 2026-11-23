# Cart

The cart is a drawer, not its own layout. The header button opens it. Stripe's cancel URL is `/cart`, which is the home page with the drawer already open. While the store is closed the drawer is empty, the header count is hidden, and there is no Checkout button.

## Sub-features

- `cart-open` opens the drawer from the header `Cart` button.
- `cart-empty` shows `Your cart is empty.` plus `Browse tea` and `Browse coffee`.
- `cart-close` closes the drawer with `Close cart` and leaves the page underneath in place.
- `cart-route` opens the same drawer by visiting `/cart`.
- `cart-checkout` would charge a card through Stripe. Do not drive it.

## How to get to it (user POV)

- Choose `Cart` in the header. The accessible name is `Cart` while the store is closed (no item count).
- Open `/cart`. That is where a shopper who leaves Stripe Checkout would land.

## Driving it with the Sip Haven harness

Preconditions:

- `doctor.sh` prints `store=closed`.
- The harness profile has no saved cart. A fresh session satisfies this.

- **Open from the header.** Run `node .cursor/skills/verify-sip-haven/harness.mjs goto /our-story` and `node .cursor/skills/verify-sip-haven/harness.mjs click --role button --name "Cart" --exact`. Then `node .cursor/skills/verify-sip-haven/harness.mjs expect --role dialog --name "Your cart" --exact` and `node .cursor/skills/verify-sip-haven/harness.mjs expect-text --text "Your cart is empty." --exact`. The story heading is still the page under the drawer. There is no `Checkout` button: `node .cursor/skills/verify-sip-haven/harness.mjs expect --role button --name "Checkout" --exact --absent`.
- **Close.** Run `node .cursor/skills/verify-sip-haven/harness.mjs click --role button --name "Close cart" --exact` and `node .cursor/skills/verify-sip-haven/harness.mjs expect --role dialog --name "Your cart" --exact --absent`. The h1 is still `Our story`. The address is still `/our-story`.
- **Route.** Run `node .cursor/skills/verify-sip-haven/harness.mjs goto /cart` and `node .cursor/skills/verify-sip-haven/harness.mjs expect --role dialog --name "Your cart" --exact`. The page under the drawer is the home page (`A little haven in every cup.`). Close it with `Close cart`. The address stays `/cart` and the dialog is gone.
- **Proof.** With the drawer open, run `node .cursor/skills/verify-sip-haven/harness.mjs screenshot --path cart/empty.png` and `node .cursor/skills/verify-sip-haven/harness.mjs snapshot --path cart/empty.aria.txt`. The snapshot includes dialog `Your cart`, `Your cart is empty.`, and the two browse links.
- **Checkout.** Do not click `Checkout` and do not add a line by writing `localStorage`. An open store with a purchasable variant is required before a checkout proof means anything, and that proof would leave this origin for Stripe. Report the missing lineup and the closed store.

## Gotchas

- The empty-cart sentence is in the dialog, which is outside `main`. `expect-main` will not see it. Use `expect-text`.
- The header button's accessible name is `Cart` when the count is hidden. On an open store with items it becomes `Cart, N item` or `Cart, N items`.
- Lines saved under `siphaven-cart-v2` are left in `localStorage` while the store is closed, but the drawer does not show them. This harness starts from an empty profile, so there is nothing saved to hide.
- Closing the drawer that `/cart` opened does not change the address back to `/`. The home page content is what `Cart` renders underneath.
- Escape also closes the drawer. The recipe uses `Close cart` so the control is named in the proof.
