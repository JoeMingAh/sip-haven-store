# Order Notification Webhook — Design Spec
**Date:** 2026-05-12  
**Project:** Sip Haven Store  
**Status:** Approved

## Goal

When a customer completes a Stripe payment, automatically send an order notification email to `joseph@siphaven.com` containing the customer's name, shipping address, items ordered, and total paid.

---

## Architecture

```
Stripe (payment completed)
  → POST /api/webhook
  → Verify Stripe signature
  → Extract order details from checkout.session.completed event
  → POST to Resend API
  → Email delivered to joseph@siphaven.com
```

**New files:**
- `api/webhook.js` — Vercel serverless function that handles Stripe webhook events

**New environment variables:**
- `STRIPE_WEBHOOK_SECRET` — from Stripe dashboard (verifies requests are genuine)
- `RESEND_API_KEY` — from Resend dashboard (sends the email)

---

## Webhook Function: `api/webhook.js`

### Trigger
Stripe event: `checkout.session.completed`

### Input
Raw request body (must NOT be parsed as JSON — Stripe signature verification requires the raw bytes)

### Important: disable Vercel body parsing
The function must export `export const config = { api: { bodyParser: false } }` — Stripe signature verification requires the raw request bytes. If Vercel parses the body first, verification always fails.

### Processing
1. Read raw body as buffer
2. Verify Stripe signature using `STRIPE_WEBHOOK_SECRET`
3. If event type is not `checkout.session.completed`, return 200 and ignore
4. Retrieve full session from Stripe with `expand: ['line_items.data.price.product']` to get product names alongside quantities
5. Build email body with: customer name, shipping address, items + product names + quantities, total amount
6. Send via Resend to `joseph@siphaven.com`
7. Return 200

### Error handling
- Invalid signature → return 400 (Stripe will retry)
- Missing shipping address → include "No address provided" in email
- Resend failure → log error, return 500 (Stripe will retry up to 3 days)

---

## Email Format

**From:** `orders@siphaven.com` (requires domain verification in Resend; use `onboarding@resend.dev` as fallback during initial testing before domain is verified)  
**To:** `joseph@siphaven.com`  
**Subject:** `New Order — {customer name}`

**Body:**
```
New order received!

Customer: {name}
Email: {email}

Shipping Address:
{line1}
{line2 if present}
{city}, {state} {postal_code}

Items:
- {product name} x{qty}
- ...

Total: ${amount}   ← amount_total from Stripe is in cents; divide by 100 before displaying (e.g. 2500 → $25.00)
```

---

## One-Time Setup (by user)

1. **Resend account** — sign up at resend.com, verify the `siphaven.com` domain, create API key
2. **Stripe webhook** — Stripe Dashboard → Developers → Webhooks → Add endpoint → URL: `https://siphaven.com/api/webhook` → event: `checkout.session.completed` → copy the signing secret
3. **Vercel env vars** — add `STRIPE_WEBHOOK_SECRET` and `RESEND_API_KEY` to Vercel dashboard
4. **Redeploy** — `vercel --prod`

---

## Out of Scope

- Customer-facing order confirmation emails (Stripe sends these automatically)
- Order management dashboard
- Inventory tracking
- The fulfillment-specific email address (revisit when sales volume warrants it)
