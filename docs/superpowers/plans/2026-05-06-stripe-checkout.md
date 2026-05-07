# Stripe Checkout Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken Shopify checkout with Stripe Checkout (hosted) deployed on Vercel, enabling customers to buy the two live products in a single cart transaction.

**Architecture:** The React frontend POSTs cart items to `/api/checkout`, a Vercel serverless function that creates a Stripe Checkout Session and returns its URL. The browser redirects to Stripe's hosted payment page. After payment, Stripe redirects to `/?checkout=success` where the app detects the query param and shows a success banner. The 10 placeholder products have their Add to Cart button disabled with a "Coming Soon" label.

**Tech Stack:** stripe (npm), Vitest, Vercel serverless functions (Node.js), React/Vite

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `api/checkout.js` | Create | Vercel serverless function — creates Stripe Checkout Session |
| `api/checkout.test.js` | Create | Unit tests for `buildLineItems` |
| `vite.config.js` | Modify | Add Vitest config |
| `package.json` | Modify | Add test script, install stripe + vitest |
| `vercel.json` | Create | Configure Vercel SPA routing |
| `.env.local` | Create | Local secrets (gitignored) |
| `.env.example` | Create | Env var template for reference |
| `src/App.jsx` | Modify | Remove Shopify, add Stripe price map, update ProductCard, update CartDrawer checkout(), add success banner |

---

## Task 1: Get Stripe API keys and create environment files

**Files:**
- Create: `.env.local`
- Create: `.env.example`

- [ ] **Step 1: Get your Stripe API keys**

  Go to **dashboard.stripe.com → Developers → API keys**. You need two keys:
  - **Publishable key** — starts with `pk_test_`
  - **Secret key** — starts with `sk_test_`

  Keep this tab open.

- [ ] **Step 2: Create `.env.local`**

  Create this file at the project root (`sip-haven-store/.env.local`). Replace the values with your real keys:

  ```
  STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE
  VITE_STRIPE_PUBLIC_KEY=pk_test_YOUR_PUBLISHABLE_KEY_HERE
  ```

  This file is already gitignored by Vite's default `.gitignore` (it ignores `*.local`). Never commit it.

- [ ] **Step 3: Create `.env.example`**

  ```
  STRIPE_SECRET_KEY=sk_test_...
  VITE_STRIPE_PUBLIC_KEY=pk_test_...
  ```

- [ ] **Step 4: Verify `.env.local` is gitignored**

  Run:
  ```bash
  git check-ignore -v .env.local
  ```

  Expected output: `.gitignore:1:.env*.local	.env.local`

  If not ignored, add `.env.local` to `.gitignore` before continuing.

- [ ] **Step 5: Commit `.env.example`**

  ```bash
  git add .env.example
  git commit -m "chore: add env var template"
  ```

---

## Task 2: Install dependencies and configure Vitest

**Files:**
- Modify: `package.json`
- Modify: `vite.config.js`

- [ ] **Step 1: Install stripe and vitest**

  ```bash
  npm install stripe
  npm install -D vitest
  ```

- [ ] **Step 2: Add test script to `package.json`**

  Find the `"scripts"` section in `package.json` and add the `test` entry:

  ```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "test": "vitest run"
  },
  ```

- [ ] **Step 3: Add Vitest config to `vite.config.js`**

  Replace the entire contents of `vite.config.js` with:

  ```javascript
  import { defineConfig } from 'vite'
  import react from '@vitejs/plugin-react'

  export default defineConfig({
    plugins: [react()],
    test: {
      environment: 'node',
    },
  })
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add package.json package-lock.json vite.config.js
  git commit -m "chore: install stripe and vitest"
  ```

---

## Task 3: Write failing tests for the checkout function

**Files:**
- Create: `api/checkout.test.js`

- [ ] **Step 1: Create the test file**

  Create `api/checkout.test.js`:

  ```javascript
  import { describe, it, expect } from 'vitest';
  import { STRIPE_PRICE_IDS, buildLineItems } from './checkout.js';

  describe('STRIPE_PRICE_IDS', () => {
    it('has an entry for sippers-whisper', () => {
      expect(STRIPE_PRICE_IDS['sippers-whisper']).toBe('price_1TUJ0FLAf4l1OXJTpwFigruL');
    });

    it('has an entry for sippers-murmur', () => {
      expect(STRIPE_PRICE_IDS['sippers-murmur']).toBe('price_1TUJ0aLAf4l1OXJTnViQqXOZ');
    });

    it('does not have entries for placeholder products', () => {
      expect(STRIPE_PRICE_IDS['daybreak-light']).toBeUndefined();
      expect(STRIPE_PRICE_IDS['forge-espresso']).toBeUndefined();
    });
  });

  describe('buildLineItems', () => {
    it('maps a single known product to a Stripe line item', () => {
      const result = buildLineItems([{ id: 'sippers-whisper', qty: 2 }]);
      expect(result).toEqual([
        { price: 'price_1TUJ0FLAf4l1OXJTpwFigruL', quantity: 2 },
      ]);
    });

    it('maps multiple known products', () => {
      const result = buildLineItems([
        { id: 'sippers-whisper', qty: 1 },
        { id: 'sippers-murmur', qty: 3 },
      ]);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ price: 'price_1TUJ0FLAf4l1OXJTpwFigruL', quantity: 1 });
      expect(result[1]).toEqual({ price: 'price_1TUJ0aLAf4l1OXJTnViQqXOZ', quantity: 3 });
    });

    it('throws for an unknown product id', () => {
      expect(() => buildLineItems([{ id: 'fake-product', qty: 1 }]))
        .toThrow('Unknown product: fake-product');
    });

    it('throws if any item in a mixed cart is unknown', () => {
      expect(() => buildLineItems([
        { id: 'sippers-whisper', qty: 1 },
        { id: 'not-real', qty: 1 },
      ])).toThrow('Unknown product: not-real');
    });
  });
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  ```bash
  npm test
  ```

  Expected: FAIL — `Cannot find module './checkout.js'`

- [ ] **Step 3: Commit the failing tests**

  ```bash
  git add api/checkout.test.js
  git commit -m "test: add failing tests for checkout buildLineItems"
  ```

---

## Task 4: Implement the serverless checkout function

**Files:**
- Create: `api/checkout.js`

- [ ] **Step 1: Create `api/checkout.js`**

  ```javascript
  import Stripe from 'stripe';

  export const STRIPE_PRICE_IDS = {
    'sippers-whisper': 'price_1TUJ0FLAf4l1OXJTpwFigruL',
    'sippers-murmur': 'price_1TUJ0aLAf4l1OXJTnViQqXOZ',
  };

  export function buildLineItems(items) {
    return items.map((item) => {
      const price = STRIPE_PRICE_IDS[item.id];
      if (!price) throw new Error(`Unknown product: ${item.id}`);
      return { price, quantity: item.qty };
    });
  }

  export default async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { items } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'No items provided' });
    }

    let line_items;
    try {
      line_items = buildLineItems(items);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const origin = req.headers.origin || 'http://localhost:5174';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/`,
    });

    return res.status(200).json({ url: session.url });
  }
  ```

- [ ] **Step 2: Run tests to confirm they pass**

  ```bash
  npm test
  ```

  Expected: All 6 tests PASS.

- [ ] **Step 3: Commit**

  ```bash
  git add api/checkout.js
  git commit -m "feat: add Stripe checkout serverless function"
  ```

---

## Task 5: Create Vercel config

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Create `vercel.json`**

  This tells Vercel to serve `index.html` for all routes that aren't API calls, enabling SPA navigation:

  ```json
  {
    "rewrites": [
      { "source": "/((?!api/).*)", "destination": "/index.html" }
    ]
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add vercel.json
  git commit -m "chore: add Vercel SPA routing config"
  ```

---

## Task 6: Update App.jsx — remove Shopify, add Stripe price map, disable placeholder products

**Files:**
- Modify: `src/App.jsx` (lines 22–58 and lines 649–705)

- [ ] **Step 1: Replace the Shopify config block**

  In `src/App.jsx`, find and replace lines 22–58 (the entire comment block + `SHOPIFY_CONFIG` + `buildCheckoutUrl`):

  **Remove this entire block (lines 22–58):**
  ```javascript
  /* =========================================================================
     SHOPIFY CONFIG  ── REPLACE THE VALUES BELOW WITH YOUR REAL STORE DETAILS.
     ...
     =========================================================================*/
  const SHOPIFY_CONFIG = {
    shopDomain: "44tem8-us.myshopify.com",
    variants: {
      "sippers-whisper": "46781182673054",
      ...
    },
  };

  const buildCheckoutUrl = (items) => {
    ...
  };
  ```

  **Replace with:**
  ```javascript
  const STRIPE_PRICE_IDS = {
    'sippers-whisper': 'price_1TUJ0FLAf4l1OXJTpwFigruL',
    'sippers-murmur': 'price_1TUJ0aLAf4l1OXJTnViQqXOZ',
  };
  ```

- [ ] **Step 2: Update `ProductCard` to disable Add to Cart for placeholder products**

  In `src/App.jsx`, find the `ProductCard` function (line 649). Replace the entire function with:

  ```javascript
  function ProductCard({ product, go, addToCart }) {
    const purchasable = Boolean(STRIPE_PRICE_IDS[product.id]);
    return (
      <div className="group cursor-pointer flex flex-col">
        <div
          className="relative aspect-square overflow-hidden mb-4"
          onClick={() => go({ name: "product", id: product.id })}
          style={{ backgroundColor: CANVAS }}
        >
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
            {product.badge && (
              <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest" style={{ backgroundColor: INK, color: COPPER }}>
                {product.badge}
              </span>
            )}
            <StockPill stock={product.stock} />
          </div>
        </div>
        <div className="flex-1 flex flex-col">
          <button onClick={() => go({ name: "product", id: product.id })} className="text-left">
            {product.roast && (
              <div className="text-[10px] tracking-[0.3em] uppercase mb-1.5" style={{ color: COPPER_DEEP }}>
                {product.roast} Roast · {product.origin}
              </div>
            )}
            <h3 className="text-xl font-black tracking-tight mb-1" style={{ color: INK }}>{product.name}</h3>
            <p className="text-sm text-stone-600 mb-3">{product.tagline}</p>
          </button>
          {product.notes && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {product.notes.map((n) => (
                <span key={n} className="text-[10px] tracking-widest uppercase px-2 py-1 border" style={{ borderColor: "#D5C8A8", color: COPPER_DEEP }}>
                  {n}
                </span>
              ))}
            </div>
          )}
          <div className="mt-auto flex items-center justify-between pt-2">
            <div className="text-lg font-black" style={{ color: INK }}>${product.price}</div>
            {purchasable ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  addToCart(product.id, 1);
                }}
                className="px-4 py-2.5 text-[10px] tracking-[0.25em] uppercase font-bold transition-colors hover:opacity-90"
                style={{ backgroundColor: INK, color: CANVAS_LIGHT }}
              >
                Add to cart
              </button>
            ) : (
              <span
                className="px-4 py-2.5 text-[10px] tracking-[0.25em] uppercase font-bold opacity-40 cursor-not-allowed"
                style={{ backgroundColor: "#888", color: CANVAS_LIGHT }}
              >
                Coming soon
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 3: Verify the site still renders**

  ```bash
  npm run dev
  ```

  Open `http://localhost:5174`. Confirm:
  - Sipper's Whisper and Sipper's Murmur show "Add to cart"
  - All other products show "Coming soon" (greyed out)
  - No console errors

- [ ] **Step 4: Commit**

  ```bash
  git add src/App.jsx
  git commit -m "feat: replace Shopify config with Stripe price map, disable placeholder products"
  ```

---

## Task 7: Update CartDrawer checkout function to call /api/checkout

**Files:**
- Modify: `src/App.jsx` (CartDrawer function, ~lines 1156–1175)

- [ ] **Step 1: Replace the `checkout` function inside `CartDrawer`**

  Find the `CartDrawer` function (line 1156). Find the `checkout` const (line 1169) and the line directly before it. Replace just the `checkout` function and add a loading state:

  **Find:**
  ```javascript
  function CartDrawer({ open, close, cart, setCart }) {
    const items = cart
      .map((c) => ({ ...c, product: findProduct(c.id) }))
      .filter((c) => c.product);
    const subtotal = items.reduce((s, i) => s + i.product.price * i.qty, 0);
    const free = subtotal >= 40;
    const remaining = Math.max(0, 40 - subtotal);

    const updateQty = (id, qty) => {
      if (qty <= 0) setCart(cart.filter((c) => c.id !== id));
      else setCart(cart.map((c) => (c.id === id ? { ...c, qty } : c)));
    };

    const checkout = () => {
      const url = buildCheckoutUrl(items);
      if (url === "#") return;
      window.open(url, "_blank", "noopener,noreferrer");
    };
  ```

  **Replace with:**
  ```javascript
  function CartDrawer({ open, close, cart, setCart }) {
    const items = cart
      .map((c) => ({ ...c, product: findProduct(c.id) }))
      .filter((c) => c.product);
    const subtotal = items.reduce((s, i) => s + i.product.price * i.qty, 0);
    const free = subtotal >= 40;
    const remaining = Math.max(0, 40 - subtotal);
    const [checkingOut, setCheckingOut] = useState(false);

    const updateQty = (id, qty) => {
      if (qty <= 0) setCart(cart.filter((c) => c.id !== id));
      else setCart(cart.map((c) => (c.id === id ? { ...c, qty } : c)));
    };

    const checkout = async () => {
      if (!items.length || checkingOut) return;
      setCheckingOut(true);
      try {
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: items.map((i) => ({ id: i.id, qty: i.qty })),
          }),
        });
        const { url, error } = await res.json();
        if (error) throw new Error(error);
        window.location.href = url;
      } catch (err) {
        console.error('Checkout failed:', err);
        setCheckingOut(false);
      }
    };
  ```

- [ ] **Step 2: Update the checkout button to show loading state**

  Find the "Secure Checkout" button inside `CartDrawer`'s return JSX. It likely looks like:
  ```jsx
  <button onClick={checkout} ...>
    <Lock ... /> Secure Checkout
  </button>
  ```

  Update it to show a loading state:
  ```jsx
  <button
    onClick={checkout}
    disabled={checkingOut || !items.length}
    className="w-full py-4 text-sm tracking-[0.2em] uppercase font-bold transition-opacity disabled:opacity-50"
    style={{ backgroundColor: INK, color: CANVAS_LIGHT }}
  >
    <Lock size={14} className="inline mr-2" />
    {checkingOut ? 'Redirecting...' : 'Secure Checkout'}
  </button>
  ```

  To find the button, search for `Secure Checkout` in App.jsx.

- [ ] **Step 3: Commit**

  ```bash
  git add src/App.jsx
  git commit -m "feat: wire CartDrawer to call /api/checkout for Stripe redirect"
  ```

---

## Task 8: Add checkout success banner

**Files:**
- Modify: `src/App.jsx` (SipHaven root component, ~line 1313)

- [ ] **Step 1: Add success state to the root `SipHaven` component**

  Find the `SipHaven` function (line 1313). Add a `checkoutSuccess` state right after the existing state declarations:

  **Find:**
  ```javascript
  export default function SipHaven() {
    const [view, setView] = useState({ name: "home" });
    const [cart, setCart] = useState([]);
    const [cartOpen, setCartOpen] = useState(false);
    const [exit, setExit] = useState({ shown: false, used: false });
  ```

  **Replace with:**
  ```javascript
  export default function SipHaven() {
    const [view, setView] = useState({ name: "home" });
    const [cart, setCart] = useState([]);
    const [cartOpen, setCartOpen] = useState(false);
    const [exit, setExit] = useState({ shown: false, used: false });
    const [checkoutSuccess, setCheckoutSuccess] = useState(
      () => new URLSearchParams(window.location.search).get('checkout') === 'success'
    );
  ```

- [ ] **Step 2: Add the success banner to the SipHaven return JSX**

  Find the `return (` inside `SipHaven`. Add the success banner as the first element inside the outermost wrapper div:

  ```jsx
  {checkoutSuccess && (
    <div
      className="fixed top-0 inset-x-0 z-50 py-4 px-6 flex items-center justify-between"
      style={{ backgroundColor: COPPER, color: CANVAS_LIGHT }}
    >
      <div className="flex items-center gap-3">
        <Check size={18} />
        <span className="text-sm font-bold tracking-wide">
          Order placed! Check your email for a receipt.
        </span>
      </div>
      <button
        onClick={() => {
          setCheckoutSuccess(false);
          window.history.replaceState({}, '', '/');
        }}
        className="opacity-80 hover:opacity-100"
      >
        <X size={18} />
      </button>
    </div>
  )}
  ```

- [ ] **Step 3: Verify the banner works locally**

  Open `http://localhost:5174/?checkout=success` in your browser. You should see a copper-colored banner at the top saying "Order placed! Check your email for a receipt." with an X to dismiss it.

- [ ] **Step 4: Commit**

  ```bash
  git add src/App.jsx
  git commit -m "feat: add post-checkout success banner"
  ```

---

## Task 9: Deploy to Vercel and test end-to-end

- [ ] **Step 1: Install Vercel CLI**

  ```bash
  npm install -g vercel
  ```

- [ ] **Step 2: Deploy to Vercel**

  From the project root:
  ```bash
  vercel
  ```

  When prompted:
  - Set up and deploy? **Y**
  - Which scope? Select your account
  - Link to existing project? **N**
  - Project name? `sip-haven-store` (or press Enter for default)
  - Directory? `.` (press Enter)
  - Override build settings? **N**

  Vercel will give you a preview URL like `https://sip-haven-store-abc123.vercel.app`.

- [ ] **Step 3: Add environment variables in Vercel dashboard**

  Go to **vercel.com → your project → Settings → Environment Variables**. Add:

  | Name | Value |
  |---|---|
  | `STRIPE_SECRET_KEY` | `sk_test_...` (from `.env.local`) |
  | `VITE_STRIPE_PUBLIC_KEY` | `pk_test_...` (from `.env.local`) |

  Set both to apply to **Production**, **Preview**, and **Development**.

- [ ] **Step 4: Redeploy to pick up env vars**

  ```bash
  vercel --prod
  ```

- [ ] **Step 5: Test checkout end-to-end**

  On your deployed URL:
  1. Add **Sipper's Whisper** or **Sipper's Murmur** to the cart
  2. Open the cart drawer and click **Secure Checkout**
  3. You should be redirected to Stripe's hosted checkout page
  4. Use the test card: `4242 4242 4242 4242` / any future expiry / any CVC / any ZIP
  5. Complete the payment
  6. You should be redirected back to your site with the success banner

- [ ] **Step 6: Push to GitHub**

  ```bash
  git push origin main
  ```

  After this, every push to `main` will auto-deploy on Vercel.

---

## Done

At this point:
- Stripe checkout is live and working for the 2 real products
- Placeholder products show "Coming Soon"
- Orders are tracked in your Stripe dashboard
- Future products: add their Stripe Price ID to `STRIPE_PRICE_IDS` in both `api/checkout.js` and `src/App.jsx` when ready
