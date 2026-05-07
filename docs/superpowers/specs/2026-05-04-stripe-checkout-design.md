# Stripe Checkout Integration — Design Spec
**Date:** 2026-05-04  
**Project:** Sip Haven Store  
**Status:** Approved

## Goal

Replace the broken Shopify checkout with Stripe Checkout (hosted), deployed on Vercel. Customers can buy the two live products in a single transaction. The other 10 placeholder products are disabled with a "Coming Soon" badge until their details are ready.

---

## Architecture

```
Vercel Deployment
├── Frontend: React/Vite (existing site, unchanged)
├── /api/checkout.js     ← new Vercel serverless function
└── /success             ← new post-payment confirmation page
```

### Checkout Flow

1. Customer adds products to cart and clicks "Secure Checkout"
2. Frontend POSTs cart (items + quantities) to `/api/checkout`
3. Vercel function creates a Stripe Checkout Session using the Stripe secret key
4. Stripe returns a session URL → frontend redirects customer to Stripe's hosted payment page
5. Customer pays → Stripe redirects to `/success`
6. Customer cancels → Stripe redirects to `/` (home page)

### What Gets Removed

- `SHOPIFY_CONFIG` object
- `buildCheckoutUrl()` function
- All Shopify variant ID references

### What Stays the Same

- Cart drawer, product catalog, all existing UI — untouched

---

## Products & Pricing

Only two products are purchasable at launch. All others display a "Coming Soon" badge and have their "Add to Cart" button disabled.

| Product | Price |
|---|---|
| Sipper's Whisper Espresso Blend | $25.00 |
| Sipper's Murmur – Swiss Water® Decaf | $25.00 |

Each product is created in the Stripe dashboard with a price. The resulting **Stripe Price ID** (`price_1ABC...`) replaces the old Shopify variant ID in the product catalog.

---

## Pages

### `/success`
- Simple confirmation: "Order placed! Check your email for a receipt."
- Link back to the store
- No order details needed (Stripe sends the receipt email)

### Cancel
- No cancel page needed — Stripe redirects to `/` on cancel

---

## Environment Variables

Stored in Vercel dashboard, never in code.

| Variable | Used By | Purpose |
|---|---|---|
| `STRIPE_SECRET_KEY` | `/api/checkout.js` (server) | Creates Checkout Sessions |
| `VITE_STRIPE_PUBLIC_KEY` | Frontend (optional, future use) | Safe to expose |

---

## Serverless Function: `/api/checkout.js`

Accepts a POST with the cart items, maps them to Stripe Price IDs, and creates a Checkout Session.

```
POST /api/checkout
Body: { items: [{ id: "sippers-whisper", qty: 2 }, ...] }
Response: { url: "https://checkout.stripe.com/..." }
```

- Validates that all items have known Price IDs (rejects unknown products)
- Sets `success_url` to `{origin}/success`
- Sets `cancel_url` to `{origin}/`
- Uses `line_items` with `price` + `quantity`

---

## Deployment

1. Push code to GitHub
2. Connect repo to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

---

## Out of Scope

- Email order confirmations (Stripe handles these)
- Inventory management
- User accounts / order history
- The 10 placeholder products (added in a future milestone when products are ready)
